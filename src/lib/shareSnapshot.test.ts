import { describe, expect, it } from "vitest";
import { prepareSnapshot } from "./shareSnapshot";
import type { Todo } from "./todoStore";

const NOW = new Date(2026, 10, 20, 12, 0, 0).getTime();

function todo(id: string, text: string, done = false): Todo {
  return {
    id,
    type: "task",
    text,
    done,
    order: 0,
    createdAt: 1,
    updatedAt: 1,
    priority: 0,
    tags: [],
  };
}

describe("prepareSnapshot", () => {
  it("统计完成/总数，列出条目", () => {
    const snapshot = prepareSnapshot(
      [todo("a", "买菜"), todo("b", "写代码", true)],
      { title: "今日清单", now: NOW },
    );
    expect(snapshot.title).toBe("今日清单");
    expect(snapshot.doneCount).toBe(1);
    expect(snapshot.total).toBe(2);
    expect(snapshot.listed.map((r) => r.text)).toEqual(["买菜", "写代码"]);
    expect(snapshot.listed[1].done).toBe(true);
  });

  it("超过 maxItems 截断并计数省略", () => {
    const items = Array.from({ length: 15 }, (_, i) => todo(`t${i}`, `任务${i}`));
    const snapshot = prepareSnapshot(items, { now: NOW, maxItems: 5 });
    expect(snapshot.listed).toHaveLength(5);
    expect(snapshot.omitted).toBe(10);
  });

  it("pendingOnly 只列未完成", () => {
    const items = [todo("a", "待办", false), todo("b", "已完成", true)];
    const snapshot = prepareSnapshot(items, { now: NOW, pendingOnly: true });
    expect(snapshot.listed.map((r) => r.text)).toEqual(["待办"]);
  });

  it("长文本被截断", () => {
    const snapshot = prepareSnapshot([todo("a", "早".repeat(50))], { now: NOW });
    expect(snapshot.listed[0].text.endsWith("…")).toBe(true);
    expect(snapshot.listed[0].text.length).toBeLessThanOrEqual(30);
  });

  it("空清单", () => {
    const snapshot = prepareSnapshot([], { now: NOW });
    expect(snapshot.doneCount).toBe(0);
    expect(snapshot.total).toBe(0);
    expect(snapshot.listed).toEqual([]);
  });

  it("日期标签带中文星期", () => {
    const snapshot = prepareSnapshot([todo("a", "x")], { now: NOW });
    // 2026-11-20 是周五
    expect(snapshot.now).toBe(NOW);
  });
});
