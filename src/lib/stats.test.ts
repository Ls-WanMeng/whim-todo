import { describe, expect, it } from "vitest";

import { addDays, startOfDay } from "./dates";
import { createTodo, type Todo } from "./todoStore";
import { heatmap, streak, tagStats, weeklyReport } from "./stats";

const NOW = new Date(2026, 10, 19, 15, 30).getTime(); // 2026-11-19 周四 15:30

function makeItem(overrides: Partial<Todo> & { text: string }): Todo {
  const base = createTodo(overrides.text, NOW);
  return { ...base, ...overrides } as Todo;
}

function doneOn(text: string, day: number, tags: string[] = []): Todo {
  const item = makeItem({ text, tags, createdAt: day });
  return { ...item, done: true, completedAt: day + 12 * 60 * 60 * 1000 };
}

describe("heatmap", () => {
  it("返回 12 列 × 7 行，最后一列为当前周", () => {
    const columns = heatmap([], NOW);
    expect(columns).toHaveLength(12);
    for (const column of columns) expect(column).toHaveLength(7);
    const last = columns[11];
    const today = startOfDay(NOW);
    expect(last.some((cell) => cell.day === today)).toBe(true);
  });

  it("统计 completedAt 落在各天的完成数并给出强度档位", () => {
    const monday = startOfDay(addDays(NOW, -3)); // 周一
    const items = Array.from({ length: 10 }, (_, i) => doneOn(`任务${i}`, monday));
    const columns = heatmap(items, NOW, 2);
    const last = columns[1];
    const cell = last.find((c) => c.day === monday)!;
    expect(cell.count).toBe(10);
    expect(cell.level).toBe(4);
  });

  it("未来日期格子的 count 为 0", () => {
    const columns = heatmap([], NOW, 2);
    const today = startOfDay(NOW);
    for (const cell of columns[1]) {
      if (cell.day > today) expect(cell.count).toBe(0);
    }
  });

  it("未完成或无 completedAt 的条目不计入", () => {
    const items = [
      makeItem({ text: "未完成" }),
      makeItem({ text: "完成但无时间", done: true }),
    ];
    expect(heatmap(items, NOW, 2).flat().every((c) => c.count === 0)).toBe(true);
  });
});

describe("streak", () => {
  it("无完成记录为 0", () => {
    expect(streak([], NOW)).toBe(0);
  });

  it("今天完成则从今天连续计数", () => {
    const items = [
      doneOn("今天", startOfDay(NOW)),
      doneOn("昨天", startOfDay(addDays(NOW, -1))),
      doneOn("前天", startOfDay(addDays(NOW, -2))),
    ];
    expect(streak(items, NOW)).toBe(3);
  });

  it("今天没完成但昨天完成，从昨天起算不断签", () => {
    const items = [
      doneOn("昨天", startOfDay(addDays(NOW, -1))),
      doneOn("前天", startOfDay(addDays(NOW, -2))),
    ];
    expect(streak(items, NOW)).toBe(2);
  });

  it("断档即停止", () => {
    const items = [
      doneOn("今天", startOfDay(NOW)),
      doneOn("两天前", startOfDay(addDays(NOW, -2))),
    ];
    expect(streak(items, NOW)).toBe(1);
  });
});

describe("tagStats", () => {
  it("分母含未完成，分子只算已完成", () => {
    const items = [
      makeItem({ text: "a", tags: ["工作"] }),
      makeItem({ text: "b", tags: ["工作"], done: true, completedAt: NOW }),
      makeItem({ text: "c", tags: ["工作"] }),
      makeItem({ text: "d", tags: ["生活"], done: true, completedAt: NOW }),
    ];
    const stats = tagStats(items);
    expect(stats).toHaveLength(2);
    const work = stats.find((s) => s.tag === "工作")!;
    expect(work.total).toBe(3);
    expect(work.done).toBe(1);
    expect(work.rate).toBe(33.3);
  });

  it("无标签返回空数组", () => {
    expect(tagStats([makeItem({ text: "x" })])).toEqual([]);
  });

  it("按 total 降序排列", () => {
    const items = [
      makeItem({ text: "a", tags: ["少"] }),
      makeItem({ text: "b", tags: ["多"] }),
      makeItem({ text: "c", tags: ["多"] }),
    ];
    const stats = tagStats(items);
    expect(stats[0].tag).toBe("多");
  });
});

describe("weeklyReport", () => {
  const monday = startOfDay(addDays(NOW, -3)); // 本周一

  it("统计本周完成/新建与当前逾期", () => {
    const lastWeek = addDays(monday, -7);
    const items = [
      doneOn("本周完成", monday),
      makeItem({ text: "上周完成", done: true, completedAt: lastWeek, createdAt: lastWeek }),
      makeItem({ text: "本周新建", createdAt: addDays(monday, 1) }),
      makeItem({ text: "逾期", dueAt: addDays(monday, -1), createdAt: lastWeek }),
      makeItem({
        text: "已完成不逾期",
        dueAt: addDays(monday, -1),
        done: true,
        completedAt: addDays(monday, -8),
        createdAt: lastWeek,
      }),
    ];
    const report = weeklyReport(items, NOW);
    expect(report.completed).toBe(1);
    // 「本周完成」createdAt 也在本周，故 created = 本周新建 + 本周完成 = 2
    expect(report.created).toBe(2);
    expect(report.overdue).toBe(1);
    expect(report.weekStart).toBe(monday);
  });

  it("Markdown 包含关键数字", () => {
    const items = [doneOn("工作项", monday, ["工作"])];
    const report = weeklyReport(items, NOW);
    expect(report.markdown).toContain("完成：1 项");
    expect(report.markdown).toContain("#工作");
  });

  it("空数据生成零值报告", () => {
    const report = weeklyReport([], NOW);
    expect(report.completed).toBe(0);
    expect(report.created).toBe(0);
    expect(report.overdue).toBe(0);
    expect(report.tags).toEqual([]);
  });
});
