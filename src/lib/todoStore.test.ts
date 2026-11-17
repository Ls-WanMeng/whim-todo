import { describe, expect, it } from "vitest";
import {
  BACKUP_KEY,
  LEGACY_STORAGE_KEY,
  STORAGE_KEY,
  clearDone,
  createTodo,
  moveTodo,
  readState,
  removeTodo,
  restoreTodos,
  serializeExport,
  parseImport,
  toggleTodo,
  updateTodoText,
  writeState,
} from "./todoStore";
import type { Todo } from "./todoStore";

function makeTodo(overrides: Partial<Todo> & Pick<Todo, "id" | "text">): Todo {
  return {
    done: false,
    order: 0,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

function mem(init: Record<string, string> = {}) {
  const map = new Map(Object.entries(init));
  return {
    map,
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
    clear: () => map.clear(),
    key: (index: number) => [...map.keys()][index] ?? null,
    get length() {
      return map.size;
    },
  } satisfies Storage;
}

describe("readState", () => {
  it("returns empty state when nothing is stored", () => {
    const result = readState(mem());

    expect(result.status).toBe("empty");
    expect(result.items).toEqual([]);
    expect(result.dropped).toBe(0);
  });

  it("migrates the legacy todo array to v2 items", () => {
    const storage = mem({
      [LEGACY_STORAGE_KEY]: JSON.stringify([
        { id: 1, text: "买牛奶", done: false },
        { id: 2, text: "写周报", done: true },
      ]),
    });

    const result = readState(storage);

    expect(result.status).toBe("migrated");
    expect(result.items.map((item) => item.text)).toEqual(["买牛奶", "写周报"]);
    expect(result.items.map((item) => item.done)).toEqual([false, true]);
    expect(result.items.map((item) => item.order)).toEqual([0, 1]);
    expect(result.items.every((item) => typeof item.id === "string" && item.id.length > 0)).toBe(true);
    expect(result.items.every((item) => typeof item.createdAt === "number")).toBe(true);
    expect(result.items.every((item) => typeof item.updatedAt === "number")).toBe(true);
  });

  it("reads a v2 state and reindexes order", () => {
    const storage = mem({
      [STORAGE_KEY]: JSON.stringify({
        version: 2,
        items: [
          { id: "b", text: "第二", done: false, order: 5, createdAt: 1, updatedAt: 2 },
          { id: "a", text: "第一", done: true, order: 1, createdAt: 1, updatedAt: 2 },
        ],
      }),
    });

    const result = readState(storage);

    expect(result.status).toBe("ok");
    expect(result.items.map((item) => item.text)).toEqual(["第一", "第二"]);
    expect(result.items.map((item) => item.order)).toEqual([0, 1]);
  });

  it("drops invalid entries instead of crashing", () => {
    const storage = mem({
      [LEGACY_STORAGE_KEY]: JSON.stringify([
        null,
        { id: 1, text: "   " },
        { id: 2, text: "保留", done: true },
      ]),
    });

    const result = readState(storage);

    expect(result.items.map((item) => item.text)).toEqual(["保留"]);
    expect(result.dropped).toBe(2);
  });

  it("backs up corrupt json and starts empty", () => {
    const storage = mem({ [STORAGE_KEY]: "{oops" });

    const result = readState(storage);

    expect(result.status).toBe("corrupt");
    expect(result.items).toEqual([]);
    expect(storage.map.get(BACKUP_KEY)).toBe("{oops");
  });

  it("keeps the legacy key until the migrated state is saved", () => {
    const storage = mem({
      [LEGACY_STORAGE_KEY]: JSON.stringify([{ id: 1, text: "旧数据", done: false }]),
    });

    readState(storage);

    expect(storage.map.has(LEGACY_STORAGE_KEY)).toBe(true);
  });
});

describe("writeState", () => {
  it("round-trips items through storage", () => {
    const storage = mem();
    const items = [
      { id: "a", text: "任务", done: false, order: 0, createdAt: 1, updatedAt: 1 },
    ];

    expect(writeState(storage, items)).toEqual({ ok: true });
    expect(readState(storage).items).toEqual(items);
  });

  it("reports a storage failure instead of throwing", () => {
    const storage = {
      getItem: () => null,
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
      removeItem: () => {},
      clear: () => {},
      key: () => null,
      length: 0,
    } satisfies Storage;

    const result = writeState(storage, []);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Quota");
  });

  it("cleans up the legacy key after a successful write", () => {
    const storage = mem({
      [LEGACY_STORAGE_KEY]: JSON.stringify([{ id: 1, text: "旧数据", done: false }]),
    });

    expect(writeState(storage, [makeTodo({ id: "a", text: "A" })])).toEqual({ ok: true });

    expect(storage.map.has(LEGACY_STORAGE_KEY)).toBe(false);
  });
});

describe("createTodo", () => {
  it("trims text and fills defaults", () => {
    const item = createTodo("  写计划  ", 1000);

    expect(item.text).toBe("写计划");
    expect(item.done).toBe(false);
    expect(item.order).toBe(0);
    expect(item.createdAt).toBe(1000);
    expect(item.updatedAt).toBe(1000);
  });

  it("generates unique ids even in the same millisecond", () => {
    const first = createTodo("a", 1000);
    const second = createTodo("b", 1000);

    expect(first.id).not.toBe(second.id);
  });
});

describe("toggleTodo", () => {
  it("flips done and bumps updatedAt without mutating the input", () => {
    const items = [makeTodo({ id: "a", text: "任务", done: false, updatedAt: 1 })];

    const next = toggleTodo(items, "a", 2000);

    expect(next[0]).toMatchObject({ done: true, updatedAt: 2000, createdAt: 1 });
    expect(items[0].done).toBe(false);
    expect(items[0].updatedAt).toBe(1);
  });

  it("ignores unknown ids", () => {
    const items = [makeTodo({ id: "a", text: "任务" })];

    expect(toggleTodo(items, "missing", 2000)).toBe(items);
  });
});

describe("updateTodoText", () => {
  it("trims and updates the text", () => {
    const items = [makeTodo({ id: "a", text: "旧", updatedAt: 1 })];

    const next = updateTodoText(items, "a", "  新内容  ", 3000);

    expect(next[0]).toMatchObject({ text: "新内容", updatedAt: 3000 });
  });

  it("ignores blank or unchanged text", () => {
    const items = [makeTodo({ id: "a", text: "旧", updatedAt: 1 })];

    expect(updateTodoText(items, "a", "   ", 3000)).toBe(items);
    expect(updateTodoText(items, "a", "旧", 3000)).toBe(items);
  });
});

describe("removeTodo and restoreTodos", () => {
  it("removes an item and restores it to the original position", () => {
    const items = [
      makeTodo({ id: "a", text: "A", order: 0 }),
      makeTodo({ id: "b", text: "B", order: 1 }),
      makeTodo({ id: "c", text: "C", order: 2 }),
    ];

    const result = removeTodo(items, "b");

    expect(result.items.map((item) => item.text)).toEqual(["A", "C"]);
    expect(result.removed?.index).toBe(1);

    const restored = restoreTodos(result.items, [result.removed!], 5000);

    expect(restored.map((item) => item.text)).toEqual(["A", "B", "C"]);
    expect(restored.map((item) => item.order)).toEqual([0, 1, 2]);
    expect(restored[1].updatedAt).toBe(5000);
  });

  it("returns null when the id is missing", () => {
    const items = [makeTodo({ id: "a", text: "A" })];

    const result = removeTodo(items, "missing");

    expect(result.items).toBe(items);
    expect(result.removed).toBeNull();
  });
});

describe("clearDone", () => {
  it("removes completed items and restores them in original order", () => {
    const items = [
      makeTodo({ id: "a", text: "A", done: true, order: 0 }),
      makeTodo({ id: "b", text: "B", done: false, order: 1 }),
      makeTodo({ id: "c", text: "C", done: true, order: 2 }),
    ];

    const result = clearDone(items);

    expect(result.items.map((item) => item.text)).toEqual(["B"]);

    const restored = restoreTodos(result.items, result.removed, 5000);

    expect(restored.map((item) => item.text)).toEqual(["A", "B", "C"]);
    expect(restored.map((item) => item.order)).toEqual([0, 1, 2]);
  });
});

describe("moveTodo", () => {
  it("moves an item down and reindexes order", () => {
    const items = [
      makeTodo({ id: "a", text: "A", order: 0 }),
      makeTodo({ id: "b", text: "B", order: 1 }),
      makeTodo({ id: "c", text: "C", order: 2 }),
    ];

    const next = moveTodo(items, "a", 1);

    expect(next.map((item) => item.text)).toEqual(["B", "A", "C"]);
    expect(next.map((item) => item.order)).toEqual([0, 1, 2]);
  });

  it("does nothing at the boundaries", () => {
    const items = [
      makeTodo({ id: "a", text: "A", order: 0 }),
      makeTodo({ id: "b", text: "B", order: 1 }),
    ];

    expect(moveTodo(items, "a", -1)).toBe(items);
    expect(moveTodo(items, "b", 1)).toBe(items);
  });
});

describe("serializeExport and parseImport", () => {
  it("exports a versioned payload", () => {
    const json = serializeExport([makeTodo({ id: "a", text: "任务" })], 9000);
    const parsed = JSON.parse(json);

    expect(parsed).toMatchObject({ app: "whim-todo", version: 2, exportedAt: 9000 });
    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0].text).toBe("任务");
  });

  it("imports an exported payload and reindexes order", () => {
    const json = serializeExport([
      makeTodo({ id: "b", text: "第二", order: 5 }),
      makeTodo({ id: "a", text: "第一", order: 1 }),
    ]);

    const result = parseImport(json);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.items.map((item) => item.text)).toEqual(["第一", "第二"]);
      expect(result.items.map((item) => item.order)).toEqual([0, 1]);
      expect(result.dropped).toBe(0);
    }
  });

  it("imports a legacy array", () => {
    const result = parseImport(
      JSON.stringify([{ id: 1, text: "旧任务", done: true }]),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.items[0]).toMatchObject({ text: "旧任务", done: true });
      expect(typeof result.items[0].id).toBe("string");
    }
  });

  it("reports invalid json", () => {
    const result = parseImport("{oops");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("JSON");
  });

  it("rejects payloads without valid items", () => {
    const result = parseImport(JSON.stringify({ version: 2, items: [{ text: "  " }] }));

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("有效");
  });

  it("reports how many invalid entries were dropped", () => {
    const result = parseImport(
      JSON.stringify([
        null,
        { text: "保留" },
        { text: "" },
      ]),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.items).toHaveLength(1);
      expect(result.dropped).toBe(2);
    }
  });
});
