/*
 * 统计模块（Sprint D 基础）：纯函数、零依赖，只读当前数据。
 * 所有函数接受 items 快照与 now 时间戳，不做任何 IO。
 */

import { addDays, isSameDay, startOfDay, DAY_MS } from "./dates";
import type { Todo } from "./todoStore";

export type HeatCell = {
  /** 该格起始日 00:00 的本地时间戳 */
  day: number;
  /** 当天完成数 */
  count: number;
  /** 0–4 的强度档位（0 = 无完成） */
  level: 0 | 1 | 2 | 3 | 4;
};

export type TagStat = {
  tag: string;
  total: number;
  done: number;
  /** 保留一位小数的完成率 0–100 */
  rate: number;
};

export type WeeklyReport = {
  /** 报告覆盖的周起始（周一 00:00） */
  weekStart: number;
  completed: number;
  overdue: number;
  created: number;
  /** 按完成数降序的标签统计 */
  tags: TagStat[];
  markdown: string;
};

const LEVELS = [0, 1, 3, 6, 10] as const;

function levelFor(count: number): HeatCell["level"] {
  let level: HeatCell["level"] = 0;
  for (let i = 1; i < LEVELS.length; i += 1) {
    if (count >= LEVELS[i]) level = i as HeatCell["level"];
  }
  return level;
}

/**
 * 周热力图数据：以 endDay 所在周为最后一周，向前共 weeks 周。
 * 返回按列（周）优先、列内周一到周日的格子；空档（未来日子）count 为 0。
 */
export function heatmap(
  items: Todo[],
  now: number,
  weeks = 12,
): HeatCell[][] {
  const counts = new Map<number, number>();
  for (const item of items) {
    if (!item.done || item.completedAt === undefined) continue;
    const day = startOfDay(item.completedAt);
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }

  // 本周周一为最后一列的起点
  const today = startOfDay(now);
  const weekday = (new Date(today).getDay() + 6) % 7; // 周一为 0
  const lastWeekStart = addDays(today, -weekday);

  const columns: HeatCell[][] = [];
  for (let w = weeks - 1; w >= 0; w -= 1) {
    const weekStart = addDays(lastWeekStart, -7 * w);
    const column: HeatCell[] = [];
    for (let d = 0; d < 7; d += 1) {
      const day = addDays(weekStart, d);
      const count = day <= today ? (counts.get(day) ?? 0) : 0;
      column.push({ day, count, level: levelFor(count) });
    }
    columns.push(column);
  }
  return columns;
}

/** 连续完成天数（streak）：从今天（或昨天，今天还没完成也不断签）往回数 */
export function streak(items: Todo[], now: number): number {
  const days = new Set<number>();
  for (const item of items) {
    if (item.done && item.completedAt !== undefined) {
      days.add(startOfDay(item.completedAt));
    }
  }
  if (days.size === 0) return 0;

  const today = startOfDay(now);
  let cursor = days.has(today) ? today : addDays(today, -1);
  if (!days.has(cursor)) return 0;

  let count = 0;
  while (days.has(cursor)) {
    count += 1;
    cursor = addDays(cursor, -1);
  }
  return count;
}

/** 标签完成率：total 为 0 的标签不返回 */export function tagStats(items: Todo[]): TagStat[] {
  const totals = new Map<string, { total: number; done: number }>();
  for (const item of items) {
    for (const tag of item.tags) {
      const entry = totals.get(tag) ?? { total: 0, done: 0 };
      entry.total += 1;
      if (item.done) entry.done += 1;
      totals.set(tag, entry);
    }
  }

  return [...totals.entries()]
    .filter(([, entry]) => entry.total > 0)
    .map(([tag, entry]) => ({
      tag,
      total: entry.total,
      done: entry.done,
      rate: Math.round((entry.done / entry.total) * 1000) / 10,
    }))
    .sort((a, b) => b.total - a.total || a.tag.localeCompare(b.tag, "zh"));
}

/**
 * 周报：统计 now 所在周（周一至今）的数据并生成 Markdown。
 * overdue 只数当前仍未完成且 dueAt 已过的任务。
 */
export function weeklyReport(items: Todo[], now: number): WeeklyReport {
  const today = startOfDay(now);
  const weekday = (new Date(today).getDay() + 6) % 7;
  const weekStart = addDays(today, -weekday);

  let completed = 0;
  let created = 0;
  for (const item of items) {
    if (item.completedAt !== undefined && item.completedAt >= weekStart) completed += 1;
    if (item.createdAt >= weekStart && item.createdAt < now + DAY_MS) created += 1;
  }
  const overdue = items.filter(
    (item) => !item.done && item.dueAt !== undefined && item.dueAt < today,
  ).length;

  const tags = tagStats(
    items.filter(
      (item) => item.completedAt !== undefined && item.completedAt >= weekStart,
    ),
  );

  const lines = [
    `# Whim Todo 周报`,
    ``,
    `- 统计范围：本周（${new Date(weekStart).getMonth() + 1}月${new Date(weekStart).getDate()}日起）`,
    `- 完成：${completed} 项`,
    `- 新建：${created} 项`,
    `- 当前逾期：${overdue} 项`,
  ];
  if (tags.length > 0) {
    lines.push(``, `## 标签分布（按本周完成计）`, ``);
    for (const stat of tags.slice(0, 8)) {
      lines.push(`- #${stat.tag}：完成 ${stat.done} / 共 ${stat.total}（${stat.rate}%）`);
    }
  }

  return {
    weekStart,
    completed,
    overdue,
    created,
    tags,
    markdown: lines.join("\n"),
  };
}

export { isSameDay };
