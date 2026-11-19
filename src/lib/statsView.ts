/*
 * 统计展示数据组装：把 stats.ts 的原始输出转成 UI 可直接消费的形状。
 * 纯函数、零依赖、不碰 DOM —— UI 接线（App.tsx）后续单独做。
 */

import { formatDateShort, startOfWeek } from "./dates";
import { heatmap, streak, tagStats, type HeatCell, type TagStat } from "./stats";
import type { Todo } from "./todoStore";

export type HeatmapView = {
  /** 列（周）标签，如 "11/2"、"11/9" */
  columns: { label: string; cells: HeatCell[] }[];
  /** 图例档位说明 */
  legend: { level: number; label: string }[];
};

export type StatsOverview = {
  streakDays: number;
  /** 本周完成数 */
  weekCompleted: number;
  /** 全部未完成数 */
  openCount: number;
  /** 当前逾期数 */
  overdueCount: number;
  tags: TagStat[];
  heatmap: HeatmapView;
};

const LEVEL_LABELS = ["无", "1–2 项", "3–5 项", "6–9 项", "10+ 项"];

export function buildHeatmapView(items: Todo[], now: number, weeks = 12): HeatmapView {
  const columns = heatmap(items, now, weeks);
  return {
    columns: columns.map((cells) => ({
      label: formatDateShort(cells[0].day, now),
      cells,
    })),
    legend: LEVEL_LABELS.map((label, level) => ({ level, label })),
  };
}

export function buildStatsOverview(items: Todo[], now: number): StatsOverview {
  const weekStart = startOfWeek(now);
  const weekCompleted = items.filter(
    (item) => item.done && item.completedAt !== undefined && item.completedAt >= weekStart,
  ).length;
  const openCount = items.filter((item) => !item.done).length;
  const overdueCount = items.filter(
    (item) => !item.done && item.dueAt !== undefined && item.dueAt < now,
  ).length;

  return {
    streakDays: streak(items, now),
    weekCompleted,
    openCount,
    overdueCount,
    tags: tagStats(items),
    heatmap: buildHeatmapView(items, now),
  };
}

/** 概览的一句话摘要（给 aria-live / 命令面板预览用） */
export function summarizeOverview(overview: StatsOverview): string {
  const parts = [`连续完成 ${overview.streakDays} 天`, `本周完成 ${overview.weekCompleted} 项`];
  if (overview.overdueCount > 0) parts.push(`逾期 ${overview.overdueCount} 项`);
  return parts.join("，");
}

