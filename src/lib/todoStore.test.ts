import { describe, expect, it } from "vitest";
import {
  BACKUP_KEY,
  LEGACY_STORAGE_KEY,
  STORAGE_KEY,
  clearDone,
  createTodo,
  moveTodo,
  moveTodoAmong,
  readState,
  removeTodo,
  restoreTodos,
  exportFileName,
  serializeExport,
  parseImport,
  toggleTodo,
  updateTodo,
  updateTodoText,
  writeState,
  MAX_TAGS,
  createMemo,
  memoTimeline,
  maxTextLength,
  MAX_TEXT_LENGTH,
  MAX_MEMO_LENGTH,
} from "./todoStore";
import type { Todo } from "./todoStore";

function makeTodo(overrides: Partial<Todo> & Pick<Todo, "id" | "text">): Todo {
  return {
    done: false,
    order: 0,
    createdAt: 1,
    updatedAt: 1,
    priority: 0,
    tags: [],
    type: "task",
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

  it("reads a v2 state, marks it for upgrade and reindexes order", () => {
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

    expect(result.status).toBe("migrated");
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
    const items = [makeTodo({ id: "a", text: "任务" })];

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
    expect(item.priority).toBe(0);
    expect(item.tags).toEqual([]);
    expect(item.dueAt).toBeUndefined();
  });

  it("accepts due date, priority and tags", () => {
    const item = createTodo("交周报", 1000, {
      dueAt: 5000,
      priority: 3,
      tags: ["#工作", "工作", "周报"],
    });

    expect(item.dueAt).toBe(5000);
    expect(item.priority).toBe(3);
    expect(item.tags).toEqual(["工作", "周报"]);
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

  it("stamps completedAt when done and clears it when reopened", () => {
    const items = [makeTodo({ id: "a", text: "任务", done: false })];

    const done = toggleTodo(items, "a", 2000);
    expect(done[0]).toMatchObject({ done: true, completedAt: 2000 });

    const reopened = toggleTodo(done, "a", 3000);
    expect(reopened[0].completedAt).toBeUndefined();
    expect(reopened[0].updatedAt).toBe(3000);
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

describe("updateTodo", () => {
  it("patches due date, priority, tags and notes", () => {
    const items = [makeTodo({ id: "a", text: "任务", updatedAt: 1 })];

    const next = updateTodo(
      items,
      "a",
      { dueAt: 5000, priority: 2, tags: ["#工作", "工作"], notes: "  记一笔  " },
      3000,
    );

    expect(next[0]).toMatchObject({
      dueAt: 5000,
      priority: 2,
      tags: ["工作"],
      notes: "记一笔",
      updatedAt: 3000,
    });
    expect(items[0].dueAt).toBeUndefined();
  });

  it("clears due date and notes with null", () => {
    const items = [
      makeTodo({ id: "a", text: "任务", dueAt: 5000, notes: "旧备注", updatedAt: 1 }),
    ];

    const next = updateTodo(items, "a", { dueAt: null, notes: null }, 3000);

    expect(next[0].dueAt).toBeUndefined();
    expect(next[0].notes).toBeUndefined();
  });

  it("returns the same array when nothing changed", () => {
    const items = [makeTodo({ id: "a", text: "任务", priority: 1, tags: ["工作"] })];

    expect(updateTodo(items, "a", { priority: 1, tags: ["工作"] }, 3000)).toBe(items);
    expect(updateTodo(items, "missing", { priority: 2 }, 3000)).toBe(items);
  });

  it("caps tags and rejects out-of-range priority", () => {
    const items = [makeTodo({ id: "a", text: "任务" })];
    const many = Array.from({ length: MAX_TAGS + 3 }, (_, index) => `t${index}`);

    const next = updateTodo(items, "a", { tags: many, priority: 9 as never }, 3000);

    expect(next[0].tags).toHaveLength(MAX_TAGS);
    expect(next[0].priority).toBe(0);
  });
});

describe("normalize on read", () => {
  it("fills defaults for old v2 items and keeps valid new fields", () => {
    const storage = mem({
      [STORAGE_KEY]: JSON.stringify({
        version: 2,
        items: [
          { id: "a", text: "旧条目", done: false, order: 0, createdAt: 1, updatedAt: 1 },
          {
            id: "b",
            text: "新条目",
            done: true,
            order: 1,
            createdAt: 2,
            updatedAt: 3,
            completedAt: 4,
            dueAt: 5,
            priority: 2,
            tags: ["#工作", "工作", 9],
            notes: "  备注  ",
            pinned: true,
          },
        ],
      }),
    });

    const result = readState(storage);

    expect(result.items[0]).toMatchObject({ priority: 0, tags: [] });
    expect(result.items[1]).toMatchObject({
      completedAt: 4,
      dueAt: 5,
      priority: 2,
      tags: ["工作"],
      notes: "备注",
      pinned: true,
    });
  });

  it("drops invalid dates instead of storing NaN", () => {
    const storage = mem({
      [STORAGE_KEY]: JSON.stringify({
        version: 3,
        items: [{ id: "a", text: "任务", dueAt: "2026-11-19", priority: 7, tags: "x" }],
      }),
    });

    const item = readState(storage).items[0];

    expect(item.dueAt).toBeUndefined();
    expect(item.priority).toBe(0);
    expect(item.tags).toEqual([]);
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

  it("moves by order field even when the array is not sorted", () => {
    const items = [
      makeTodo({ id: "c", text: "C", order: 2 }),
      makeTodo({ id: "a", text: "A", order: 0 }),
      makeTodo({ id: "b", text: "B", order: 1 }),
    ];

    const next = moveTodo(items, "a", 1);

    expect(next.map((item) => item.text)).toEqual(["B", "A", "C"]);
    expect(next.map((item) => item.order)).toEqual([0, 1, 2]);
  });

  it("swaps neighbors inside a filtered view without touching the rest", () => {
    const items = [
      makeTodo({ id: "a", text: "A", order: 0 }),
      makeTodo({ id: "b", text: "B", order: 1 }),
      makeTodo({ id: "c", text: "C", order: 2 }),
    ];

    const next = moveTodoAmong(items, ["a", "c"], "a", 1);

    expect(next.map((item) => item.text)).toEqual(["C", "B", "A"]);
    expect(next.map((item) => item.order)).toEqual([0, 1, 2]);
  });
});

describe("serializeExport and parseImport", () => {
  it("exports a versioned payload", () => {
    const json = serializeExport([makeTodo({ id: "a", text: "任务" })], 9000);
    const parsed = JSON.parse(json);

    expect(parsed).toMatchObject({ app: "whim-todo", version: 3, exportedAt: 9000 });
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

describe("exportFileName", () => {
  it("uses the local calendar date with zero padding", () => {
    const earlyMorning = new Date(2026, 10, 18, 0, 30);

    expect(exportFileName(earlyMorning)).toBe("whim-todo-2026-11-18.json");
  });

  it("pads single-digit months and days", () => {
    expect(exportFileName(new Date(2027, 0, 5, 23, 59))).toBe("whim-todo-2027-01-05.json");
  });
});

describe("memo 数据层（C5-1）", () => {
  function makeMemo(overrides: Partial<Todo> & Pick<Todo, "id" | "text">): Todo {
    return makeTodo({ type: "memo", done: false, ...overrides });
  }

  it("createMemo 落 memo 默认值：无日期、无优先级、未完成", () => {
    const item = createMemo("  随手记  ", 1000, {
      dueAt: 5000,
      priority: 3,
      tags: ["灵感"],
      notes: "细节",
    });

    expect(item.type).toBe("memo");
    expect(item.text).toBe("随手记");
    expect(item.done).toBe(false);
    expect(item.completedAt).toBeUndefined();
    expect(item.dueAt).toBeUndefined();
    expect(item.priority).toBe(0);
    expect(item.tags).toEqual(["灵感"]);
    expect(item.notes).toBe("细节");
    expect(item.pinned).toBeUndefined();
  });

  it("createMemo 支持置顶", () => {
    expect(createMemo("置顶", 1000, { pinned: true }).pinned).toBe(true);
  });

  it("createMemo 保留长正文，超过上限才截断", () => {
    expect(createMemo("长".repeat(300), 1000).text).toHaveLength(300);
    expect(createMemo("长".repeat(MAX_MEMO_LENGTH + 50), 1000).text).toHaveLength(MAX_MEMO_LENGTH);
  });

  it("createTodo 默认是任务，正文仍按 200 字收口", () => {
    const item = createTodo("任".repeat(300), 1000);
    expect(item.type).toBe("task");
    expect(item.text).toHaveLength(MAX_TEXT_LENGTH);
  });

  it("maxTextLength 按类型返回上限", () => {
    expect(maxTextLength()).toBe(MAX_TEXT_LENGTH);
    expect(maxTextLength("task")).toBe(MAX_TEXT_LENGTH);
    expect(maxTextLength("memo")).toBe(MAX_MEMO_LENGTH);
  });

  it("读取时把 memo 的 dueAt / priority / completedAt 抹掉，done 强制 false", () => {
    const storage = mem({
      [STORAGE_KEY]: JSON.stringify({
        version: 3,
        items: [
          {
            id: "m1",
            type: "memo",
            text: "备忘",
            done: true,
            completedAt: 9,
            dueAt: 5000,
            priority: 3,
            pinned: true,
            createdAt: 1,
            updatedAt: 2,
          },
        ],
      }),
    });

    const item = readState(storage).items[0];
    expect(item.type).toBe("memo");
    expect(item.done).toBe(false);
    expect(item.completedAt).toBeUndefined();
    expect(item.dueAt).toBeUndefined();
    expect(item.priority).toBe(0);
    expect(item.pinned).toBe(true);
  });

  it("未知 / 缺失的 type 一律回落到任务", () => {
    const storage = mem({
      [STORAGE_KEY]: JSON.stringify({
        version: 3,
        items: [
          { id: "t1", text: "没写类型", createdAt: 1, updatedAt: 1 },
          { id: "t2", type: "MEMO", text: "大小写不对", createdAt: 1, updatedAt: 1 },
          { id: "t3", type: "note", text: "别的类型", createdAt: 1, updatedAt: 1 },
        ],
      }),
    });

    expect(readState(storage).items.map((item) => item.type)).toEqual(["task", "task", "task"]);
  });

  it("备忘的长正文在读取时不被 200 字截断", () => {
    const storage = mem({
      [STORAGE_KEY]: JSON.stringify({
        version: 3,
        items: [{ id: "m1", type: "memo", text: "长".repeat(800), createdAt: 1, updatedAt: 1 }],
      }),
    });

    expect(readState(storage).items[0].text).toHaveLength(800);
  });

  it("导出 JSON 带 type，且 memo 不写空日期字段", () => {
    const json = serializeExport([createMemo("备忘", 1000, { tags: ["灵感"] })], 9000);
    const parsed = JSON.parse(json) as { version: number; items: Record<string, unknown>[] };

    expect(parsed.version).toBe(3);
    expect(parsed.items[0].type).toBe("memo");
    expect(parsed.items[0].priority).toBe(0);
    expect("dueAt" in parsed.items[0]).toBe(false);
  });

  it("导出后再导入，memo 的类型 / 标签 / 置顶都还在", () => {
    const json = serializeExport(
      [createMemo("备忘 A", 1000, { tags: ["灵感", "读书"], pinned: true })],
      9000,
    );
    const result = parseImport(json);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.items[0]).toMatchObject({
        type: "memo",
        text: "备忘 A",
        tags: ["灵感", "读书"],
        pinned: true,
        dueAt: undefined,
        priority: 0,
      });
    }
  });

  it("导入无 type 的旧文件时按任务还原", () => {
    const result = parseImport(
      JSON.stringify({ version: 3, items: [{ id: "t1", text: "旧任务", createdAt: 1, updatedAt: 1 }] }),
    );

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.items[0].type).toBe("task");
  });

  it("toggleTodo 对备忘无操作，引用不变", () => {
    const items = [makeMemo({ id: "m1", text: "备忘" })];
    expect(toggleTodo(items, "m1", 2000)).toBe(items);
  });

  it("清除已完成不会碰到备忘", () => {
    const items = [
      makeTodo({ id: "t1", text: "任务", done: true }),
      makeMemo({ id: "m1", text: "备忘" }),
    ];

    const result = clearDone(items);
    expect(result.items.map((item) => item.id)).toEqual(["m1"]);
    expect(result.removed).toHaveLength(1);
  });

  it("updateTodo 对备忘忽略 dueAt / priority，但标签与置顶生效", () => {
    const items = [makeMemo({ id: "m1", text: "备忘" })];

    const next = updateTodo(
      items,
      "m1",
      { dueAt: 5000, priority: 3, tags: ["灵感"], pinned: true },
      3000,
    );

    expect(next[0].dueAt).toBeUndefined();
    expect(next[0].priority).toBe(0);
    expect(next[0].tags).toEqual(["灵感"]);
    expect(next[0].pinned).toBe(true);
    expect(next[0].updatedAt).toBe(3000);
  });

  it("updateTodo 对备忘保留长正文，对任务仍截到 200 字", () => {
    const memos = [makeMemo({ id: "m1", text: "短" })];
    const nextMemo = updateTodo(memos, "m1", { text: "长".repeat(1300) }, 2000);
    expect(nextMemo[0].text).toHaveLength(MAX_MEMO_LENGTH);

    const tasks = [makeTodo({ id: "t1", text: "短" })];
    const nextTask = updateTodo(tasks, "t1", { text: "长".repeat(300) }, 2000);
    expect(nextTask[0].text).toHaveLength(MAX_TEXT_LENGTH);
  });

  it("updateTodo 无实际变化时返回原引用", () => {
    const items = [makeMemo({ id: "m1", text: "备忘", pinned: true })];
    expect(updateTodo(items, "m1", { pinned: true }, 3000)).toBe(items);
    expect(updateTodo(items, "m1", { dueAt: 5000, priority: 2 }, 3000)).toBe(items);
  });

  it("updateTodoText 对备忘按 1200 字收口", () => {
    const items = [makeMemo({ id: "m1", text: "短" })];
    const next = updateTodoText(items, "m1", "长".repeat(1300), 2000);
    expect(next[0].text).toHaveLength(MAX_MEMO_LENGTH);
  });

  it("删除与撤销都保留 memo 类型", () => {
    const items = [makeTodo({ id: "t1", text: "任务" }), makeMemo({ id: "m1", text: "备忘" })];

    const removed = removeTodo(items, "m1");
    expect(removed.removed?.item.type).toBe("memo");

    const restored = restoreTodos(removed.items, removed.removed ? [removed.removed] : [], 5000);
    expect(restored.map((item) => item.type)).toEqual(["task", "memo"]);
    expect(restored[1].updatedAt).toBe(5000);
  });

  it("写盘结构仍是 v3 且带 type", () => {
    const storage = mem();
    writeState(storage, [makeMemo({ id: "m1", text: "备忘" })]);

    const parsed = JSON.parse(storage.getItem(STORAGE_KEY) ?? "{}") as {
      version: number;
      items: Todo[];
    };
    expect(parsed.version).toBe(3);
    expect(parsed.items[0].type).toBe("memo");
  });
});

describe("memoTimeline（C5-1）", () => {
  const NOW = new Date(2026, 10, 19, 12, 0, 0).getTime(); // 2026-11-19 周四
  const at = (day: number, hour = 9, minute = 0) => new Date(2026, 10, day, hour, minute, 0).getTime();

  function memoAt(id: string, createdAt: number, pinned?: boolean): Todo {
    return makeTodo({ id, text: id, type: "memo", createdAt, updatedAt: createdAt, pinned });
  }

  it("置顶区与时间线分开返回，置顶不再重复出现在时间线", () => {
    const timeline = memoTimeline(
      [memoAt("pin", at(10), true), memoAt("today", at(19, 8))],
      NOW,
    );

    expect(timeline.pinned.map((m) => m.id)).toEqual(["pin"]);
    expect(timeline.groups.map((g) => g.key)).toEqual(["today"]);
    expect(timeline.groups[0].items.map((m) => m.id)).toEqual(["today"]);
    expect(timeline.total).toBe(2);
  });

  it("按今天 / 昨天 / 本周内 / 更早分组", () => {
    const timeline = memoTimeline(
      [
        memoAt("today", at(19, 8)),
        memoAt("yesterday", at(18, 20)),
        memoAt("week", at(17, 9)),
        memoAt("older", at(2, 9)),
      ],
      NOW,
    );

    expect(timeline.groups.map((g) => g.key)).toEqual([
      "today",
      "yesterday",
      "thisWeek",
      "earlier",
    ]);
    expect(timeline.groups.map((g) => g.label)).toEqual(["今天", "昨天", "本周内", "更早"]);
    expect(timeline.groups.map((g) => g.items[0].id)).toEqual([
      "today",
      "yesterday",
      "week",
      "older",
    ]);
  });

  it("组内按创建时间倒序", () => {
    const timeline = memoTimeline([memoAt("a", at(19, 8)), memoAt("b", at(19, 11))], NOW);
    expect(timeline.groups[0].items.map((m) => m.id)).toEqual(["b", "a"]);
  });

  it("置顶区也按创建时间倒序", () => {
    const timeline = memoTimeline(
      [memoAt("old", at(2), true), memoAt("new", at(12), true)],
      NOW,
    );
    expect(timeline.pinned.map((m) => m.id)).toEqual(["new", "old"]);
  });

  it("忽略任务条目", () => {
    const timeline = memoTimeline(
      [memoAt("m", at(19, 8)), makeTodo({ id: "t", text: "任务", createdAt: at(19, 9) })],
      NOW,
    );

    expect(timeline.total).toBe(1);
    expect(timeline.groups.every((g) => g.items.every((item) => item.type === "memo"))).toBe(true);
  });

  it("空列表返回空时间线", () => {
    expect(memoTimeline([], NOW)).toEqual({ pinned: [], groups: [], total: 0 });
  });

  it("未来创建时间归入今天", () => {
    const timeline = memoTimeline([memoAt("future", at(21))], NOW);
    expect(timeline.groups.map((g) => g.key)).toEqual(["today"]);
  });

  it("昨天 00:00 归昨天，前天 23:59 归本周内", () => {
    const timeline = memoTimeline(
      [
        memoAt("edge", new Date(2026, 10, 18, 0, 0, 0).getTime()),
        memoAt("prev", new Date(2026, 10, 17, 23, 59, 0).getTime()),
      ],
      NOW,
    );

    expect(timeline.groups.map((g) => g.key)).toEqual(["yesterday", "thisWeek"]);
  });

  it("本周一 00:00 算本周内，上周日 23:59 算更早", () => {
    const timeline = memoTimeline(
      [
        memoAt("monday", new Date(2026, 10, 16, 0, 0, 0).getTime()),
        memoAt("lastSunday", new Date(2026, 10, 15, 23, 59, 0).getTime()),
      ],
      NOW,
    );

    expect(timeline.groups.map((g) => g.key)).toEqual(["thisWeek", "earlier"]);
  });

  it("dayStart 传非零点也归一到当天", () => {
    const a = memoTimeline([memoAt("m", at(19, 8))], NOW);
    const b = memoTimeline([memoAt("m", at(19, 8))], new Date(2026, 10, 19, 0, 0, 0).getTime());
    expect(a).toEqual(b);
  });

  it("不改动入参", () => {
    const items = [memoAt("b", at(19, 8)), memoAt("a", at(19, 11))];
    const before = JSON.stringify(items);
    memoTimeline(items, NOW);
    expect(JSON.stringify(items)).toBe(before);
  });
});