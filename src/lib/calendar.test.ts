import { describe, expect, it } from "vitest";

import { buildMonthGrid, buildWeekView, formatMonthTitle } from "./calendar";
import { addDays, startOfDay, startOfWeek } from "./dates";
import { createTodo, type Todo } from "./todoStore";

const NOW = new Date(2026, 10, 19, 15, 30).getTime(); // 2026-11-19 周四 15:30

function makeItem(overrides: Partial<Todo> & { text: string }): Todo {
  const base = createTodo(overrides.text, NOW);
  return { ...base, ...overrides } as Todo;
}

function dueOn(text: string, day: number, done = false): Todo {
  const item = makeItem({ text, dueAt: day });
  return done ? { ...item, done: true, completedAt: day } : item;
}

describe("buildWeekView", () => {
  it("返回 7 格，周一为首，含今天标记", () => {
    const view = buildWeekView([], NOW);
    expect(view.cells).toHaveLength(7);
    const monday = startOfDay(addDays(NOW, -3)); // 2026-11-16 周一
    expect(view.cells[0].day).toBe(monday);
    const today = view.cells.find((c) => c.isToday);
    expect(today?.day).toBe(startOfDay(NOW));
  });

  it("把任务归到对应星期，未完成/已完成都收", () => {
    const monday = startOfDay(addDays(NOW, -3));
    const friday = startOfDay(addDays(NOW, 1));
    const items = [dueOn("周一任务", monday), dueOn("周五任务", friday), dueOn("周五已完成", friday, true)];
    const view = buildWeekView(items, NOW);
    expect(view.cells[0].todos.map((t) => t.text)).toEqual(["周一任务"]);
    const fridayCell = view.cells.find((c) => c.day === friday)!;
    expect(fridayCell.todos).toHaveLength(2);
    expect(fridayCell.openCount).toBe(1);
  });

  it("无日期任务不进周视图", () => {
    const items = [makeItem({ text: "无日期" })];
    const view = buildWeekView(items, NOW);
    for (const cell of view.cells) expect(cell.todos).toHaveLength(0);
  });

  it("统计本周完成数与本周逾期数", () => {
    const weekStart = startOfWeek(NOW);
    const items = [
      dueOn("完成", weekStart, true),
      { ...dueOn("完成2", weekStart, true), completedAt: addDays(weekStart, 1) },
      dueOn("逾期", addDays(weekStart, -1)), // 上周逾期，不算本周逾期
      dueOn("本周逾期", addDays(weekStart, 2)),
    ];
    const view = buildWeekView(items, NOW);
    expect(view.weekCompleted).toBe(2);
    expect(view.weekOverdue).toBe(1);
  });
});

describe("buildMonthGrid", () => {
  it("返回 42 格，含前后月占位格", () => {
    const grid = buildMonthGrid([], NOW);
    expect(grid.cells).toHaveLength(42);
    expect(grid.monthStart).toBe(new Date(2026, 10, 1).getTime());
    const outside = grid.cells.filter((c) => c.outside);
    expect(outside.length).toBeGreaterThan(0);
  });

  it("当月有任务的天数统计正确", () => {
    const nov1 = new Date(2026, 10, 1).getTime();
    const nov15 = new Date(2026, 10, 15).getTime();
    const oct31 = new Date(2026, 9, 31).getTime(); // 上月占位格
    const items = [dueOn("a", nov1), dueOn("b", nov15), dueOn("c", oct31)];
    const grid = buildMonthGrid(items, NOW);
    expect(grid.activeDays).toBe(2);
  });

  it("当月完成数统计正确", () => {
    const nov10 = new Date(2026, 10, 10).getTime();
    const items = [
      { ...dueOn("完成", nov10, true), completedAt: nov10 },
      { ...dueOn("上月完成", new Date(2026, 9, 20).getTime(), true), completedAt: new Date(2026, 9, 20).getTime() },
    ];
    const grid = buildMonthGrid(items, NOW);
    expect(grid.monthCompleted).toBe(1);
  });
});

describe("formatMonthTitle", () => {
  it("格式化为 年月", () => {
    expect(formatMonthTitle(new Date(2026, 10, 1).getTime())).toBe("2026年11月");
    expect(formatMonthTitle(new Date(2026, 0, 1).getTime())).toBe("2026年1月");
  });
});
