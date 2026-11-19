import { describe, expect, it } from "vitest";
import { dailyReview, dailyReviewSeed, reviewSeedForBatch, reviewableMemos } from "./review";
import type { Todo } from "./todoStore";

const NOW = new Date(2026, 10, 19, 12, 0).getTime(); // 2026-11-19 周四
const DAY = 24 * 60 * 60 * 1000;

function memo(id: string, daysAgo: number): Todo {
  const createdAt = NOW - daysAgo * DAY;
  return {
    id,
    type: "memo",
    text: `备忘${id}`,
    done: false,
    order: 0,
    createdAt,
    updatedAt: createdAt,
    priority: 0,
    tags: [],
  };
}

function task(id: string, daysAgo: number): Todo {
  return { ...memo(id, daysAgo), type: "task" };
}

describe("dailyReview (C5-5)", () => {
  it("same seed on the same day returns a fixed selection", () => {
    const items = Array.from({ length: 20 }, (_, i) => memo(`m${i}`, 10 + i));
    const a = dailyReview(items, NOW, 20261119);
    const b = dailyReview(items, NOW, 20261119);

    expect(a.map((m) => m.id)).toEqual(b.map((m) => m.id));
    expect(a).toHaveLength(3);
  });

  it("next day (new seed) can pick a different batch", () => {
    const items = Array.from({ length: 30 }, (_, i) => memo(`m${i}`, 10 + i));
    const today = dailyReview(items, NOW, 20261119);
    const tomorrow = dailyReview(items, NOW + DAY, 20261120);

    expect(today.map((m) => m.id)).not.toEqual(tomorrow.map((m) => m.id));
  });

  it("only picks memos older than 7 days and skips tasks / fresh memos", () => {
    const items = [
      memo("old", 8),
      memo("fresh", 3),
      task("task-old", 20),
      memo("edge", 7), // 恰好 7 天（同一天 0 点之后）不算旧
    ];

    const picked = dailyReview(items, NOW, 42);

    expect(picked.map((m) => m.id)).toEqual(["old"]);
  });

  it("returns fewer than 3 when the pool is small, and [] when empty", () => {
    expect(dailyReview([memo("a", 30), memo("b", 20)], NOW, 7)).toHaveLength(2);
    expect(dailyReview([memo("new", 1)], NOW, 7)).toEqual([]);
    expect(dailyReview([], NOW, 7)).toEqual([]);
  });

  it("换一批: reviewSeedForBatch gives a different but deterministic batch", () => {
    const items = Array.from({ length: 20 }, (_, i) => memo(`m${i}`, 10 + i));
    const first = dailyReview(items, NOW, 20261119);
    const again = dailyReview(items, NOW, reviewSeedForBatch(20261119, 1));
    const againSame = dailyReview(items, NOW, reviewSeedForBatch(20261119, 1));

    expect(again).toHaveLength(3);
    expect(again.map((m) => m.id)).toEqual(againSame.map((m) => m.id));
    expect(again.map((m) => m.id)).not.toEqual(first.map((m) => m.id));
  });

  it("dailyReviewSeed is fixed within a day and changes the next day", () => {
    expect(dailyReviewSeed(NOW)).toBe(dailyReviewSeed(NOW + 60_000));
    expect(dailyReviewSeed(NOW)).not.toBe(dailyReviewSeed(NOW + DAY));
  });
});

describe("reviewableMemos (C5-5)", () => {
  it("keeps only memos created before the 7-day cutoff", () => {
    const items = [memo("old", 9), memo("edge", 7), memo("fresh", 6)];
    expect(reviewableMemos(items, NOW).map((item) => item.id)).toEqual(["old"]);
  });

  it("ignores tasks even when they are old", () => {
    const items = [task("task-old", 40), memo("memo-old", 40)];
    expect(reviewableMemos(items, NOW).map((item) => item.id)).toEqual(["memo-old"]);
  });

  it("survives bad input without throwing", () => {
    expect(reviewableMemos([], NOW)).toEqual([]);
    expect(reviewableMemos(null as unknown as Todo[], NOW)).toEqual([]);
  });
});
