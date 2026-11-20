/*
 * 日历视图数据组装：把 todos 转成周视图 / 月视图可消费的形状。
 * 纯函数、零依赖、不碰 DOM —— UI 接线（CalendarView.tsx）单独做。
 */

import { addDays, isSameDay, startOfWeek } from "./dates";
import type { Todo } from "./todoStore";

export type CalendarCell = {
  /** 当天 00:00 的本地时间戳 */
  day: number;
  /** 属于该天的任务（未完成 + 已完成都收，按 dueAt / order 排序） */
  todos: Todo[];
  /** 未完成数 */
  openCount: number;
  /** 是否今天 */
  isToday: boolean;
  /** 是否属于当前展示的周/月之外（用于占位格） */
  outside: boolean;
};

export type WeekView = {
  /** 周一为一周之首，7 个格子 */
  cells: CalendarCell[];
  /** 本周完成数 */
  weekCompleted: number;
  /** 本周逾期未完成数 */
  weekOverdue: number;
};

export type MonthGrid = {
  /** 月首（当月 1 号 00:00） */
  monthStart: number;
  /** 42 格（6 行 × 7 列），保证覆盖所有月份，含前后月的占位格 */
  cells: CalendarCell[];
  /** 当月有任务的天数 */
  activeDays: number;
  /** 当月完成数 */
  monthCompleted: number;
};

const WEEKDAY_LABELS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

export const CALENDAR_WEEKDAY_LABELS = WEEKDAY_LABELS;

/** 把一个时间戳归到某天（纯函数，供测试用） */
function todoBelongsToDay(todo: Todo, day: number): boolean {
  return todo.dueAt !== undefined && isSameDay(todo.dueAt, day);
}

function byDueThenOrder(a: Todo, b: Todo): number {
  const da = a.dueAt ?? 0;
  const db = b.dueAt ?? 0;
  if (da !== db) return da - db;
  return a.order - b.order;
}

function makeCell(day: number, todos: Todo[], now: number): CalendarCell {
  const dayTodos = todos.filter((t) => todoBelongsToDay(t, day)).sort(byDueThenOrder);
  return {
    day,
    todos: dayTodos,
    openCount: dayTodos.filter((t) => !t.done).length,
    isToday: isSameDay(day, now),
    outside: false,
  };
}

function makeOutsideCell(day: number, now: number): CalendarCell {
  return { day, todos: [], openCount: 0, isToday: isSameDay(day, now), outside: true };
}

/** 组装周视图（周一为首） */
export function buildWeekView(todos: Todo[], now = Date.now()): WeekView {
  const weekStart = startOfWeek(now);
  const cells: CalendarCell[] = [];
  for (let i = 0; i < 7; i++) {
    cells.push(makeCell(addDays(weekStart, i), todos, now));
  }

  const weekEnd = addDays(weekStart, 7);
  const weekCompleted = todos.filter(
    (t) => t.done && t.completedAt !== undefined && t.completedAt >= weekStart && t.completedAt < weekEnd,
  ).length;
  const weekOverdue = todos.filter(
    (t) => !t.done && t.dueAt !== undefined && t.dueAt < now && t.dueAt >= weekStart,
  ).length;

  return { cells, weekCompleted, weekOverdue };
}

/** 组装月视图（6×7 固定网格，含前后月占位格） */
export function buildMonthGrid(todos: Todo[], now = Date.now()): MonthGrid {
  const day = new Date(now);
  const monthStart = new Date(day.getFullYear(), day.getMonth(), 1).getTime();
  const firstWeekday = (new Date(monthStart).getDay() + 6) % 7; // 周一为 0

  // 网格起点：月首所在的周一
  const gridStart = addDays(monthStart, -firstWeekday);

  const cells: CalendarCell[] = [];
  for (let i = 0; i < 42; i++) {
    const cellDay = addDays(gridStart, i);
    const inMonth = new Date(cellDay).getMonth() === new Date(monthStart).getMonth();
    if (inMonth) {
      cells.push(makeCell(cellDay, todos, now));
    } else {
      cells.push(makeOutsideCell(cellDay, now));
    }
  }

  const nextMonth = new Date(day.getFullYear(), day.getMonth() + 1, 1).getTime();
  const monthCompleted = todos.filter(
    (t) => t.done && t.completedAt !== undefined && t.completedAt >= monthStart && t.completedAt < nextMonth,
  ).length;
  const activeDays = cells.filter((c) => !c.outside && c.todos.length > 0).length;

  return { monthStart, cells, activeDays, monthCompleted };
}

/** 某月标题，如 "2026年11月" */
export function formatMonthTitle(monthStart: number): string {
  const date = new Date(monthStart);
  return `${date.getFullYear()}年${date.getMonth() + 1}月`;
}
