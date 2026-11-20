import { addDays, startOfDay, startOfWeek } from "./dates";
import { nextRepeatDueAt, normalizeRepeat } from "./repeat";
import type { RepeatRule } from "./repeat";

export const STORAGE_KEY = "whim-todo:v2";
export const LEGACY_STORAGE_KEY = "dsh-demo-todos";
export const BACKUP_KEY = "whim-todo:corrupt-backup";
export const SCHEMA_VERSION = 3;
export const MAX_TEXT_LENGTH = 200;
export const MAX_NOTES_LENGTH = 2000;
export const MAX_TAGS = 8;
export const MAX_TAG_LENGTH = 24;
/** 备忘允许更长的正文（任务仍按 200 字收口） */
export const MAX_MEMO_LENGTH = 1200;

export type Priority = 0 | 1 | 2 | 3;

export type ItemType = "task" | "memo";

/** 正文长度上限按类型区分：备忘是长文本 */
export function maxTextLength(type: ItemType = "task"): number {
  return type === "memo" ? MAX_MEMO_LENGTH : MAX_TEXT_LENGTH;
}

/** memo 的约束：无 dueAt / priority（恒空 / 0），done 恒 false，pinned 生效 */
function normalizeType(value: unknown): ItemType {
  return value === "memo" ? "memo" : "task";
}

export type Todo = {
  id: string;
  type: ItemType;
  text: string;
  done: boolean;
  order: number;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  dueAt?: number;
  priority: Priority;
  tags: string[];
  notes?: string;
  pinned?: boolean;
  /** C6：重复规则，只有任务才有；完成时据此生成下一条 */
  repeat?: RepeatRule;
};

export type TodoPatch = {
  text?: string;
  /** null 表示清除截止时间 */
  dueAt?: number | null;
  priority?: Priority;
  tags?: string[];
  /** null 表示清除备注 */
  notes?: string | null;
  pinned?: boolean;
  /** null 表示取消重复 */
  repeat?: RepeatRule | null;
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

function optionalTimestamp(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function clampPriority(value: unknown): Priority {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 3
    ? (value as Priority)
    : 0;
}

export function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const tags: string[] = [];
  for (const raw of value) {
    if (typeof raw !== "string") continue;
    const tag = raw.trim().replace(/^#+/, "").slice(0, MAX_TAG_LENGTH);
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    tags.push(tag);
    if (tags.length >= MAX_TAGS) break;
  }
  return tags;
}

export function normalizeNotes(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const notes = value.trim().slice(0, MAX_NOTES_LENGTH);
  return notes ? notes : undefined;
}

function normalizeItem(
  raw: unknown,
  index: number,
  now: number,
  seenIds: Set<string>,
): Todo | null {
  if (!raw || typeof raw !== "object") return null;

  const record = raw as Record<string, unknown>;
  const type = normalizeType(record.type);
  const text =
    typeof record.text === "string" ? record.text.trim().slice(0, maxTextLength(type)) : "";
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
  const done = record.done === true;

  return {
    id,
    type,
    text,
    done: type === "memo" ? false : done,
    order: asNumber(record.order, index),
    createdAt,
    updatedAt: asNumber(record.updatedAt, createdAt),
    completedAt: type === "memo" ? undefined : optionalTimestamp(record.completedAt),
    /* memo 恒无截止时间与优先级 */
    dueAt: type === "memo" ? undefined : optionalTimestamp(record.dueAt),
    priority: type === "memo" ? 0 : clampPriority(record.priority),
    tags: normalizeTags(record.tags),
    notes: normalizeNotes(record.notes),
    pinned: record.pinned === true ? true : undefined,
    /* C6：重复规则只属于任务；非法或缺失都回到「不重复」 */
    repeat: type === "memo" ? undefined : normalizeRepeat(record.repeat),
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
  const storedVersion = (parsed as Record<string, unknown> | null)?.version;
  const needsUpgrade = typeof storedVersion === "number" && storedVersion < SCHEMA_VERSION;
  return { items, status: needsUpgrade ? "migrated" : "ok", dropped };
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

/**
 * 跨标签页冲突合并：以 id 并集为基础，同 id 取 `updatedAt` 较新者，再按 order 重排。
 *
 * 适用场景：两个标签页各自增改「不同」条目（常见顺序操作），避免旧快照整表覆盖新改动。
 * 已知边界：删除无墓碑，若一侧已删、另一侧仍持有该条目，合并会把它「复活」——
 * 这种删除冲突仍由调用方的「整体以最新写入为准」兜底，本函数只用于增量增强。
 */
export function mergeByUpdatedAt(local: Todo[], incoming: Todo[]): Todo[] {
  const incomingById = new Map(incoming.map((item) => [item.id, item]));
  const merged = new Map<string, Todo>();

  for (const item of incoming) {
    merged.set(item.id, item);
  }
  for (const item of local) {
    const other = incomingById.get(item.id);
    if (!other) {
      merged.set(item.id, item);
    } else if (item.updatedAt > other.updatedAt) {
      merged.set(item.id, item);
    }
  }

  const result = [...merged.values()].sort((a, b) => a.order - b.order);
  return reindex(result.map((item) => ({ ...item })));
}

export function createTodo(
  text: string,
  now = Date.now(),
  patch: TodoPatch = {},
  type: ItemType = "task",
): Todo {
  const isMemo = type === "memo";
  return {
    id: newId(),
    type,
    text: text.trim().slice(0, maxTextLength(type)),
    done: false,
    order: 0,
    createdAt: now,
    updatedAt: now,
    dueAt: isMemo ? undefined : patch.dueAt ?? undefined,
    priority: isMemo ? 0 : clampPriority(patch.priority ?? 0),
    tags: normalizeTags(patch.tags ?? []),
    notes: normalizeNotes(patch.notes),
    pinned: patch.pinned ? true : undefined,
    repeat: isMemo ? undefined : normalizeRepeat(patch.repeat),
  };
}

/** 新建一条备忘（无日期 / 无优先级 / 未完成） */
export function createMemo(text: string, now = Date.now(), patch: TodoPatch = {}): Todo {
  return createTodo(text, now, patch, "memo");
}

/** 类型守卫：memo 走备忘 UI 分支（无勾选 / 无日期详情） */
export function isMemo(item: Todo): boolean {
  return item?.type === "memo";
}

export function toggleTodo(items: Todo[], id: string, now = Date.now()): Todo[] {
  const index = items.findIndex((item) => item.id === id);
  if (index < 0 || items[index].type === "memo") return items;

  const next = items.slice();
  const done = !items[index].done;
  next[index] = {
    ...items[index],
    done,
    updatedAt: now,
    completedAt: done ? now : undefined,
  };
  return next;
}

export type ToggleResult = {
  items: Todo[];
  /** 被切换的条目；id 不存在或备忘时为 null */
  target: Todo | null;
  /** 这次完成后新生成的重复实例；没生成时为 null */
  spawned: Todo | null;
  /** 是否变成已完成 */
  completed: boolean;
};

/** 生成重复任务的下一条实例：正文 / 优先级 / 标签 / 备注 / 规则继承，id 与时间全新 */
function spawnRepeat(source: Todo, items: Todo[], now: number): Todo {
  const rule = source.repeat as RepeatRule;
  const nextOrder = items.reduce((max, item) => Math.max(max, item.order), -1) + 1;
  return {
    id: newId(),
    type: "task",
    text: source.text,
    done: false,
    order: nextOrder,
    createdAt: now,
    updatedAt: now,
    dueAt: nextRepeatDueAt(rule, now, source.dueAt),
    priority: source.priority,
    tags: [...source.tags],
    notes: source.notes,
    repeat: rule,
  };
}

/**
 * 勾选 / 取消勾选；带 repeat 的任务在「完成」这一刻续期：
 * 以 completedAt（即 now）与原截止日期的较晚者为基准，生成下一条实例。
 * 原条目原样保留历史（done + completedAt），它的 dueAt 不被改写。
 */
export function toggleTodoWithRepeat(items: Todo[], id: string, now = Date.now()): ToggleResult {
  const index = items.findIndex((item) => item.id === id);
  if (index < 0) return { items, target: null, spawned: null, completed: false };

  const current = items[index];
  if (current.type === "memo") return { items, target: null, spawned: null, completed: false };

  const done = !current.done;
  const target: Todo = {
    ...current,
    done,
    updatedAt: now,
    completedAt: done ? now : undefined,
  };

  const withTarget = items.slice();
  withTarget[index] = target;

  if (!done || !current.repeat) return { items: withTarget, target, spawned: null, completed: done };

  const spawned = spawnRepeat(current, withTarget, now);
  return { items: [...withTarget, spawned], target, spawned, completed: true };
}

export function updateTodoText(
  items: Todo[],
  id: string,
  text: string,
  now = Date.now(),
): Todo[] {
  const index = items.findIndex((item) => item.id === id);
  if (index < 0) return items;

  const nextText = text.trim().slice(0, maxTextLength(items[index].type));
  if (!nextText || items[index].text === nextText) return items;

  const next = items.slice();
  next[index] = { ...next[index], text: nextText, updatedAt: now };
  return next;
}

function sameRepeat(a?: RepeatRule, b?: RepeatRule): boolean {
  if (!a || !b) return a === b;
  if (a.kind !== b.kind) return false;
  if (a.kind === "weekly" && b.kind === "weekly") return a.weekday === b.weekday;
  return true;
}

function samePatchValue(a: Todo, b: Todo): boolean {
  return (
    a.text === b.text &&
    a.dueAt === b.dueAt &&
    a.priority === b.priority &&
    a.tags.length === b.tags.length &&
    a.tags.every((tag, index) => tag === b.tags[index]) &&
    a.notes === b.notes &&
    a.pinned === b.pinned &&
    sameRepeat(a.repeat, b.repeat)
  );
}

export function updateTodo(
  items: Todo[],
  id: string,
  patch: TodoPatch,
  now = Date.now(),
): Todo[] {
  const index = items.findIndex((item) => item.id === id);
  if (index < 0) return items;

  const current = items[index];
  const next: Todo = { ...current };
  const isMemo = current.type === "memo";

  if (patch.text !== undefined) {
    const text = patch.text.trim().slice(0, maxTextLength(current.type));
    if (text) next.text = text;
  }
  if (patch.dueAt !== undefined && !isMemo) {
    if (patch.dueAt === null) next.dueAt = undefined;
    else if (Number.isFinite(patch.dueAt)) next.dueAt = Math.max(0, patch.dueAt);
  }
  if (patch.priority !== undefined && !isMemo) next.priority = clampPriority(patch.priority);
  if (patch.tags !== undefined) next.tags = normalizeTags(patch.tags);
  if (patch.notes !== undefined) {
    next.notes = patch.notes === null ? undefined : normalizeNotes(patch.notes);
  }
  if (patch.pinned !== undefined) next.pinned = patch.pinned ? true : undefined;
  if (patch.repeat !== undefined && !isMemo) next.repeat = normalizeRepeat(patch.repeat);

  if (samePatchValue(current, next)) return items;

  next.updatedAt = now;
  const out = items.slice();
  out[index] = next;
  return out;
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

/** 在给定的一组 id（当前视图顺序）内交换位置，再按 order 归一并排序 */
export function moveTodoAmong(
  items: Todo[],
  ids: string[],
  id: string,
  delta: number,
): Todo[] {
  const index = ids.indexOf(id);
  const target = index + delta;
  if (index < 0 || target < 0 || target >= ids.length) return items;

  const moving = items.find((item) => item.id === ids[index]);
  const neighbor = items.find((item) => item.id === ids[target]);
  if (!moving || !neighbor) return items;

  const next = items.map((item) => {
    if (item.id === moving.id) return { ...item, order: neighbor.order };
    if (item.id === neighbor.id) return { ...item, order: moving.order };
    return item;
  });

  next.sort((a, b) => a.order - b.order).forEach((item, order) => {
    item.order = order;
  });
  return next;
}

/** 按 order 字段移动，筛选视图下不会因为数组下标错位（D12） */
export function moveTodo(items: Todo[], id: string, delta: number): Todo[] {
  const ids = [...items].sort((a, b) => a.order - b.order).map((item) => item.id);
  return moveTodoAmong(items, ids, id, delta);
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


/* ===== C5-1 备忘时间线（纯函数，按创建日期分组） ===== */

export type MemoGroupKey = "today" | "yesterday" | "thisWeek" | "earlier";

export const MEMO_GROUP_ORDER: MemoGroupKey[] = ["today", "yesterday", "thisWeek", "earlier"];

export const MEMO_GROUP_LABELS: Record<MemoGroupKey, string> = {
  today: "今天",
  yesterday: "昨天",
  thisWeek: "本周内",
  earlier: "更早",
};

export type MemoGroup = { key: MemoGroupKey; label: string; items: Todo[] };

export type MemoTimeline = { pinned: Todo[]; groups: MemoGroup[]; total: number };

/** 组内按创建时间倒序，同一时刻用 order 保序 */
function byCreatedDesc(a: Todo, b: Todo): number {
  return b.createdAt - a.createdAt || a.order - b.order;
}

/**
 * 备忘时间线：置顶区 + 按创建日期分组的时间线（今天 / 昨天 / 本周内 / 更早）。
 * 任务条目会被忽略；置顶的备忘只进置顶区，不再重复出现在时间线里。
 * @param items 全部条目
 * @param dayStart 今天的 00:00（宿主用 startOfDay(now) 传入），非零点会先归一到当天
 */
export function memoTimeline(items: Todo[], dayStart = Date.now()): MemoTimeline {
  const today = startOfDay(dayStart);
  const yesterday = addDays(today, -1);
  const weekStart = startOfWeek(today);
  const pinned: Todo[] = [];
  const buckets = new Map<MemoGroupKey, Todo[]>();

  for (const item of Array.isArray(items) ? items : []) {
    if (!item || item.type !== "memo") continue;

    if (item.pinned === true) {
      pinned.push(item);
      continue;
    }

    const day = startOfDay(item.createdAt);
    const key: MemoGroupKey =
      day >= today
        ? "today"
        : day >= yesterday
          ? "yesterday"
          : day >= weekStart
            ? "thisWeek"
            : "earlier";

    const list = buckets.get(key);
    if (list) list.push(item);
    else buckets.set(key, [item]);
  }

  pinned.sort(byCreatedDesc);

  const groups = MEMO_GROUP_ORDER.filter((key) => (buckets.get(key)?.length ?? 0) > 0).map(
    (key) => ({
      key,
      label: MEMO_GROUP_LABELS[key],
      items: (buckets.get(key) ?? []).sort(byCreatedDesc),
    }),
  );

  return {
    pinned,
    groups,
    total: pinned.length + groups.reduce((sum, group) => sum + group.items.length, 0),
  };
}