/**
 * 可选池 · 习惯打卡（纯函数，零依赖）
 *
 * 极简「每日一次」：一个习惯一天只需点一下，不搞次数、不搞时段。
 * 数据独立存储（`whim-todo:habits`），不污染 Todo 列表。
 *
 * 所有函数接受数据快照与 now 时间戳，不做任何 IO；本地日历按「天」粒度算。
 */

import { addDays, startOfDay, startOfWeek } from "./dates";

export const HABIT_STORAGE_KEY = "whim-todo:habits";
export const HABIT_SCHEMA_VERSION = 1;
export const MAX_HABIT_NAME_LENGTH = 40;

export type Habit = {
  id: string;
  name: string;
  createdAt: number;
  /** 已打卡的「天」（当天 00:00 的本地时间戳），升序、去重 */
  checkins: number[];
};

export type HabitState = {
  version: number;
  habits: Habit[];
};

/* ---------------- 校验与读取 ---------------- */

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** 校验并规整单条习惯；非法字段回退默认值，整条非法返回 null */
export function normalizeHabit(value: unknown): Habit | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;

  const id = typeof record.id === "string" && record.id.length > 0 ? record.id : null;
  if (id === null) return null;

  const rawName = typeof record.name === "string" ? record.name : "";
  const name = rawName.trim().slice(0, MAX_HABIT_NAME_LENGTH);
  if (name.length === 0) return null;

  const createdAt = isFiniteNumber(record.createdAt) ? record.createdAt : Date.now();

  const checkins = Array.isArray(record.checkins)
    ? [...new Set(record.checkins.filter(isFiniteNumber).map(startOfDay))].sort((a, b) => a - b)
    : [];

  return { id, name, createdAt, checkins };
}

export type HabitReadStatus = "ok" | "empty" | "corrupt";

export type HabitReadResult =
  | { status: "ok" | "empty"; habits: Habit[] }
  | { status: "corrupt"; habits: Habit[] };

/** 读取习惯数据；坏 JSON 降级为空，不抛错 */
export function readHabits(storage: Storage): HabitReadResult {
  try {
    const raw = storage.getItem(HABIT_STORAGE_KEY);
    if (!raw) return { status: "empty", habits: [] };
    const parsed = JSON.parse(raw) as { habits?: unknown };
    const habits = Array.isArray(parsed?.habits)
      ? parsed.habits.map(normalizeHabit).filter((h): h is Habit => h !== null)
      : [];
    return { status: "ok", habits };
  } catch {
    return { status: "corrupt", habits: [] };
  }
}

export function writeHabits(storage: Storage, habits: Habit[]): boolean {
  try {
    const state: HabitState = { version: HABIT_SCHEMA_VERSION, habits };
    storage.setItem(HABIT_STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

/* ---------------- 纯函数操作 ---------------- */

let idCounter = 0;
function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  idCounter += 1;
  return `${Date.now().toString(36)}-${idCounter.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createHabit(name: string, now = Date.now()): Habit {
  return {
    id: newId(),
    name: name.trim().slice(0, MAX_HABIT_NAME_LENGTH),
    createdAt: now,
    checkins: [],
  };
}

/** 某天是否已打卡（dayTs 当天任意时刻均可） */
export function isCheckedOn(habit: Habit, dayTs: number): boolean {
  const day = startOfDay(dayTs);
  return habit.checkins.some((d) => startOfDay(d) === day);
}

/** 打卡 / 取消打卡某一天；返回新数组（不改入参） */
export function toggleCheckin(habit: Habit, dayTs: number): Habit {
  const day = startOfDay(dayTs);
  const checked = habit.checkins.includes(day);
  const checkins = checked
    ? habit.checkins.filter((d) => d !== day)
    : [...habit.checkins, day].sort((a, b) => a - b);
  return { ...habit, checkins };
}

/** 更新习惯名；空名返回原样（不产生空名习惯） */
export function renameHabit(habit: Habit, name: string): Habit {
  const trimmed = name.trim().slice(0, MAX_HABIT_NAME_LENGTH);
  if (trimmed.length === 0) return habit;
  return { ...habit, name: trimmed };
}

/** 删除习惯；返回新数组 */
export function removeHabit(habits: Habit[], id: string): Habit[] {
  return habits.filter((h) => h.id !== id);
}

/* ---------------- 统计 ---------------- */

/** 连续打卡天数：从今天（或昨天，今天还没打不断签）往回数 */
export function habitStreak(habit: Habit, now = Date.now()): number {
  if (habit.checkins.length === 0) return 0;
  const set = new Set(habit.checkins.map(startOfDay));
  const today = startOfDay(now);
  let cursor = set.has(today) ? today : addDays(today, -1);
  if (!set.has(cursor)) return 0;

  let count = 0;
  while (set.has(cursor)) {
    count += 1;
    cursor = addDays(cursor, -1);
  }
  return count;
}

/** 本周（周一至今）打卡天数 */
export function weekCheckedCount(habit: Habit, now = Date.now()): number {
  const weekStart = startOfWeek(now);
  const weekEnd = weekStart + 7 * 24 * 60 * 60 * 1000;
  return habit.checkins.filter((d) => {
    const day = startOfDay(d);
    return day >= weekStart && day < weekEnd;
  }).length;
}

/** 本月打卡天数 */
export function monthCheckedCount(habit: Habit, now = Date.now()): number {
  const date = new Date(startOfDay(now));
  const year = date.getFullYear();
  const month = date.getMonth();
  return habit.checkins.filter((d) => {
    const day = startOfDay(d);
    const d2 = new Date(day);
    return d2.getFullYear() === year && d2.getMonth() === month;
  }).length;
}

/** 汇总所有习惯的连续/周/月统计，供概览卡用 */
export function habitOverview(habits: Habit[], now = Date.now()): {
  total: number;
  bestStreak: number;
  checkedToday: number;
} {
  const today = startOfDay(now);
  let bestStreak = 0;
  let checkedToday = 0;
  for (const habit of habits) {
    bestStreak = Math.max(bestStreak, habitStreak(habit, now));
    if (isCheckedOn(habit, today)) checkedToday += 1;
  }
  return { total: habits.length, bestStreak, checkedToday };
}
