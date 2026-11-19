import { describe, expect, it } from "vitest";
import { searchItems, splitByRanges } from "./search";
import type { Todo } from "./search";

function makeTodo(id: string, text: string, extra: Partial<Todo> = {}): Todo {
  return {
    id,
    text,
    done: false,
    order: 0,
    createdAt: 0,
    updatedAt: 0,
    priority: 0,
    tags: [],
    ...extra,
  };
}

describe("searchItems", () => {
  it("空 query 返回空数组", () => {
    const items = [makeTodo("1", "买牛奶")];
    expect(searchItems(items, "")).toEqual([]);
    expect(searchItems(items, "   ")).toEqual([]);
  });

  it("空列表返回空数组", () => {
    expect(searchItems([], "牛奶")).toEqual([]);
  });

  it("大小写不敏感地匹配正文", () => {
    const hit = searchItems([makeTodo("1", "读书 Report")], "report");
    expect(hit).toHaveLength(1);
    expect(hit[0].ranges).toEqual([{ start: 3, end: 9 }]);
  });

  it("中文标签也能命中，且不带正文高亮区间", () => {
    const hit = searchItems([makeTodo("1", "买点东西", { tags: ["工作"] })], "工作");
    expect(hit).toHaveLength(1);
    expect(hit[0].ranges).toEqual([]);
  });

  it("备注命中优先级最低", () => {
    const hit = searchItems([makeTodo("1", "买点东西", { notes: "下班路上顺便买" })], "顺便");
    expect(hit).toHaveLength(1);
    expect(hit[0].ranges).toEqual([]);
  });

  it("权重排序：正文 > 标签 > 备注", () => {
    const items = [
      makeTodo("1", "写周报", { notes: "牛奶" }),
      makeTodo("2", "写周报", { tags: ["牛奶"] }),
      makeTodo("3", "买牛奶"),
    ];
    expect(searchItems(items, "牛奶").map((h) => h.item.id)).toEqual(["3", "2", "1"]);
  });

  it("同一档内命中位置靠前的排前面", () => {
    const items = [makeTodo("1", "顺便买牛奶"), makeTodo("2", "牛奶")];
    expect(searchItems(items, "牛奶").map((h) => h.item.id)).toEqual(["2", "1"]);
  });

  it("同一档同一位置时保持传入顺序", () => {
    const items = [makeTodo("1", "牛奶 A"), makeTodo("2", "牛奶 B")];
    expect(searchItems(items, "牛奶").map((h) => h.item.id)).toEqual(["1", "2"]);
  });

  it("正文多次出现时给出多个高亮区间", () => {
    const hit = searchItems([makeTodo("1", "牛奶 面包 牛奶")], "牛奶");
    expect(hit[0].ranges).toEqual([
      { start: 0, end: 2 },
      { start: 6, end: 8 },
    ]);
  });

  it("没有 tags / notes 字段的老数据也不会抛错", () => {
    const legacy = { id: "x", text: "买牛奶", done: false, order: 0, createdAt: 0, updatedAt: 0 } as Todo;
    expect(searchItems([legacy], "牛奶")).toHaveLength(1);
    expect(searchItems([legacy], "不存在")).toEqual([]);
  });

  it("不改动入参", () => {
    const items = [makeTodo("2", "牛奶"), makeTodo("1", "面包")];
    const before = JSON.stringify(items);
    searchItems(items, "牛奶");
    expect(JSON.stringify(items)).toBe(before);
  });
});

describe("splitByRanges", () => {
  it("按高亮区间切段", () => {
    expect(splitByRanges("买牛奶回家", [{ start: 1, end: 3 }])).toEqual([
      { text: "买", match: false },
      { text: "牛奶", match: true },
      { text: "回家", match: false },
    ]);
  });

  it("没有区间时原样返回一段", () => {
    expect(splitByRanges("买牛奶", [])).toEqual([{ text: "买牛奶", match: false }]);
  });

  it("越界与重叠区间被安全丢掉", () => {
    expect(
      splitByRanges("abcdef", [
        { start: 2, end: 99 },
        { start: 1, end: 3 },
        { start: 2, end: 4 },
      ]),
    ).toEqual([
      { text: "a", match: false },
      { text: "bc", match: true },
      { text: "def", match: false },
    ]);
  });

  it("空文本返回空段", () => {
    expect(splitByRanges("", [{ start: 0, end: 1 }])).toEqual([]);
  });
});

/* ===== C5-4：备忘也走同一套索引（正文 > 标签 > 备注，权重与任务一致） ===== */

describe("searchItems 兼容备忘（C5-4）", () => {
  it("正文命中的备忘会被搜到，并保留 type 供角标使用", () => {
    const items = [makeTodo("m1", "周三要交燃气课程设计", { type: "memo" })];
    const hits = searchItems(items, "燃气");

    expect(hits).toHaveLength(1);
    expect(hits[0].item.type).toBe("memo");
    expect(hits[0].ranges).toEqual([{ start: 4, end: 6 }]);
  });

  it("标签命中的备忘排在正文命中的任务之后", () => {
    const items = [
      makeTodo("m1", "随手记", { type: "memo", tags: ["燃气"] }),
      makeTodo("t1", "燃气表读数", { type: "task" }),
    ];

    expect(searchItems(items, "燃气").map((hit) => hit.item.id)).toEqual(["t1", "m1"]);
  });

  it("备忘的备注也算命中，但权重低于标签", () => {
    const items = [
      makeTodo("m1", "随手记", { type: "memo", notes: "燃气灶要换" }),
      makeTodo("m2", "随手记", { type: "memo", tags: ["燃气"] }),
    ];

    expect(searchItems(items, "燃气").map((hit) => hit.item.id)).toEqual(["m2", "m1"]);
  });

  it("正文同权重时按传入顺序稳定排序（任务 / 备忘一视同仁）", () => {
    const items = [
      makeTodo("m1", "燃气账单", { type: "memo" }),
      makeTodo("t1", "燃气费", { type: "task" }),
    ];

    expect(searchItems(items, "燃气").map((hit) => hit.item.id)).toEqual(["m1", "t1"]);
  });
});