import { describe, expect, it } from "vitest";

import { addDays, startOfDay, startOfWeek, formatDateShort } from "./dates";
import { createTodo, type Todo } from "./todoStore";
import { buildHeatmapView, buildStatsOverview, summarizeOverview } from "./statsView";

const NOW = new Date(2026, 10, 19, 15, 30).getTime(); // 2026-11-19 周四

function doneOn(text: string, completedAt: number, tags: string[] = []): Todo {
  const base = createTodo(text, completedAt, { tags });
  return { ...base, done: true, completedAt };
}

describe("buildHeatmapView", () => {
  it("列标签为每周一的日期短文案", () => {
    const view = buildHeatmapView([], NOW, 4);
    expect(view.columns).toHaveLength(4);
    const monday = startOfWeek(NOW);
    expect(view.columns[3].label).toBe(formatDateShort(monday, NOW));
  });

  it("图例 5 档", () => {
    expect(buildHeatmapView([], NOW).legend).toHaveLength(5);
  });

  it("完成数据映射到对应格子", () => {
    const monday = startOfDay(startOfWeek(NOW));
    const items = Array.from({ length: 10 }, (_, i) => doneOn(`t${i}`, monday + i * 60000));
    const view = buildHeatmapView(items, NOW, 2);
    const cell = view.columns[1].cells.find((c) => c.day === monday)!;
    expect(cell.count).toBe(10);
    expect(cell.level).toBe(4);
  });
});

describe("buildStatsOverview", () => {
  it("汇总 streak / 本周完成 / 未完成 / 逾期 / 标签", () => {
    const monday = startOfDay(startOfWeek(NOW));
    const items = [
      doneOn("a", NOW, ["工作"]),
      doneOn("b", monday, ["工作"]),
      createTodo("未完成", NOW),
      { ...createTodo("逾期", NOW), dueAt: addDays(NOW, -1) },
    ];
    // 修正逾期项：dueAt 为过去时间戳
    items[3] = { ...items[3], dueAt: addDays(NOW, -1) };
    const overview = buildStatsOverview(items, NOW);
    expect(overview.streakDays).toBeGreaterThanOrEqual(1);
    expect(overview.weekCompleted).toBe(2);
    expect(overview.openCount).toBe(2);
    expect(overview.overdueCount).toBe(1);
    expect(overview.tags[0].tag).toBe("工作");
    expect(overview.heatmap.columns).toHaveLength(12);
  });

  it("空数据为零值", () => {
    const overview = buildStatsOverview([], NOW);
    expect(overview.streakDays).toBe(0);
    expect(overview.weekCompleted).toBe(0);
    expect(overview.openCount).toBe(0);
    expect(overview.overdueCount).toBe(0);
    expect(overview.tags).toEqual([]);
  });
});

describe("summarizeOverview", () => {
  it("含 streak 与本周完成，有逾期时追加提示", () => {
    const monday = startOfDay(startOfWeek(NOW));
    const overview = buildStatsOverview([doneOn("a", monday)], NOW);
    const text = summarizeOverview(overview);
    expect(text).toContain("连续完成 0 天"); // 完成记录在周一，周四看 streak 已断
    expect(text).toContain("本周完成 1 项");
    expect(text).not.toContain("逾期");

    const withOverdue = buildStatsOverview(
      [{ ...createTodo("逾期", NOW), dueAt: addDays(NOW, -3) }],
      NOW,
    );
    expect(summarizeOverview(withOverdue)).toContain("逾期 1 项");
  });
});
