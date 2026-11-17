export const STORAGE_KEY = "whim-todo:v2";
export const LEGACY_STORAGE_KEY = "dsh-demo-todos";
export const BACKUP_KEY = "whim-todo:corrupt-backup";
export const SCHEMA_VERSION = 2;
export const MAX_TEXT_LENGTH = 200;

export type Todo = {
  id: string;
  text: string;
  done: boolean;
  order: number;
  createdAt: number;
  updatedAt: number;
};

export type ReadStatus = "ok" | "empty" | "migrated" | "corrupt";

export type ReadResult = {
  items: Todo[];
  status: ReadStatus;
  dropped: number;
};

export type WriteResult = { ok: true } | { ok: false; error: string };

export type RemovedTodo = { item: Todo; index: number };

function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `todo_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeItem(
  raw: unknown,
  index: number,
  now: number,
  seenIds: Set<string>,
): Todo | null {
  if (!raw || typeof raw !== "object") return null;

  const record = raw as Record<string, unknown>;
  const text = typeof record.text === "string" ? record.text.trim().slice(0, MAX_TEXT_LENGTH) : "";
  if (!text) return null;

  let id =
    typeof record.id === "string"
      ? record.id
      : typeof record.id === "number" && Number.isFinite(record.id)
        ? String(record.id)
        : "";
  if (!id || seenIds.has(id)) id = newId();
  seenIds.add(id);

  const createdAt = asNumber(record.createdAt, now);
  return {
    id,
    text,
    done: record.done === true,
    order: asNumber(record.order, index),
    createdAt,
    updatedAt: asNumber(record.updatedAt, createdAt),
  };
}

function normalizeItems(rawItems: unknown[], now = Date.now()): { items: Todo[]; dropped: number } {
  const seenIds = new Set<string>();
  const items: Todo[] = [];

  rawItems.forEach((raw, index) => {
    const item = normalizeItem(raw, index, now, seenIds);
    if (item) items.push(item);
  });

  items.sort((a, b) => a.order - b.order);
  items.forEach((item, index) => {
    item.order = index;
  });

  return { items, dropped: rawItems.length - items.length };
}

function backupCorrupt(storage: Storage, raw: string): void {
  try {
    storage.setItem(BACKUP_KEY, raw);
  } catch {
    // 备份失败不阻塞启动
  }
}

function readRawItems(parsed: unknown): unknown[] | null {
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === "object") {
    const items = (parsed as Record<string, unknown>).items;
    if (Array.isArray(items)) return items;
  }
  return null;
}

export function readState(storage: Storage): ReadResult {
  let raw: string | null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return { items: [], status: "corrupt", dropped: 0 };
  }

  if (raw === null) {
    let legacyRaw: string | null;
    try {
      legacyRaw = storage.getItem(LEGACY_STORAGE_KEY);
    } catch {
      legacyRaw = null;
    }
    if (legacyRaw === null) return { items: [], status: "empty", dropped: 0 };

    let legacyParsed: unknown;
    try {
      legacyParsed = JSON.parse(legacyRaw);
    } catch {
      backupCorrupt(storage, legacyRaw);
      return { items: [], status: "corrupt", dropped: 0 };
    }

    const legacyItems = readRawItems(legacyParsed);
    if (!legacyItems) {
      backupCorrupt(storage, legacyRaw);
      return { items: [], status: "corrupt", dropped: 0 };
    }

    const { items, dropped } = normalizeItems(legacyItems);
    return { items, status: "migrated", dropped };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    backupCorrupt(storage, raw);
    return { items: [], status: "corrupt", dropped: 0 };
  }

  const rawItems = readRawItems(parsed);
  if (!rawItems) {
    backupCorrupt(storage, raw);
    return { items: [], status: "corrupt", dropped: 0 };
  }

  const { items, dropped } = normalizeItems(rawItems);
  return { items, status: "ok", dropped };
}

export function writeState(storage: Storage, items: Todo[]): WriteResult {
  try {
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: SCHEMA_VERSION, items }),
    );
    try {
      storage.removeItem(LEGACY_STORAGE_KEY);
    } catch {
      // 迁移后清理失败不影响数据
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function reindex(items: Todo[]): Todo[] {
  items.forEach((item, index) => {
    item.order = index;
  });
  return items;
}

export function createTodo(text: string, now = Date.now()): Todo {
  return {
    id: newId(),
    text: text.trim().slice(0, MAX_TEXT_LENGTH),
    done: false,
    order: 0,
    createdAt: now,
    updatedAt: now,
  };
}

export function toggleTodo(items: Todo[], id: string, now = Date.now()): Todo[] {
  const index = items.findIndex((item) => item.id === id);
  if (index < 0) return items;

  const next = items.slice();
  next[index] = { ...next[index], done: !next[index].done, updatedAt: now };
  return next;
}

export function updateTodoText(
  items: Todo[],
  id: string,
  text: string,
  now = Date.now(),
): Todo[] {
  const index = items.findIndex((item) => item.id === id);
  if (index < 0) return items;

  const nextText = text.trim().slice(0, MAX_TEXT_LENGTH);
  if (!nextText || items[index].text === nextText) return items;

  const next = items.slice();
  next[index] = { ...next[index], text: nextText, updatedAt: now };
  return next;
}

export function removeTodo(
  items: Todo[],
  id: string,
): { items: Todo[]; removed: RemovedTodo | null } {
  const index = items.findIndex((item) => item.id === id);
  if (index < 0) return { items, removed: null };

  return {
    items: items.filter((item) => item.id !== id),
    removed: { item: items[index], index },
  };
}

export function restoreTodos(
  items: Todo[],
  removed: RemovedTodo[],
  now = Date.now(),
): Todo[] {
  if (removed.length === 0) return items;

  const restored = removed.map(({ item }) => ({ ...item, updatedAt: now }));
  const merged = [...items, ...restored].sort((a, b) => a.order - b.order);
  return reindex(merged);
}

export function clearDone(items: Todo[]): { items: Todo[]; removed: RemovedTodo[] } {
  const removed: RemovedTodo[] = [];
  items.forEach((item, index) => {
    if (item.done) removed.push({ item, index });
  });

  return {
    items: items.filter((item) => !item.done),
    removed,
  };
}

export function moveTodo(items: Todo[], id: string, delta: number): Todo[] {
  const index = items.findIndex((item) => item.id === id);
  if (index < 0) return items;

  const target = index + delta;
  if (target < 0 || target >= items.length) return items;

  const next = items.slice();
  const [moved] = next.splice(index, 1);
  next.splice(target, 0, moved);
  return reindex(next);
}

export function exportFileName(now = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `whim-todo-${now.getFullYear()}-${month}-${day}.json`;
}

export function serializeExport(items: Todo[], exportedAt = Date.now()): string {
  return JSON.stringify(
    {
      app: "whim-todo",
      version: SCHEMA_VERSION,
      exportedAt,
      items,
    },
    null,
    2,
  );
}

export type ImportResult =
  | { ok: true; items: Todo[]; dropped: number }
  | { ok: false; error: string };

export function parseImport(text: string): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: "JSON 格式不正确" };
  }

  const rawItems = readRawItems(parsed);
  if (!rawItems) {
    return { ok: false, error: "文件里没有待办数据" };
  }

  const { items, dropped } = normalizeItems(rawItems);
  if (items.length === 0) {
    return { ok: false, error: "没有可导入的有效条目" };
  }

  return { ok: true, items, dropped };
}


