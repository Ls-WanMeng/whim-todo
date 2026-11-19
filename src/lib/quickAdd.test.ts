import { describe, expect, it } from "vitest";
import { addLocalDays, parseMemoInput, parseQuickAdd, removeQuickAddToken, startOfLocalDay } from "./quickAdd";

/** 固定参照时刻，绝不依赖真实时间 */
const NOW_THU = new Date(2026, 10, 19, 0, 0, 0, 0).getTime(); // 2026-11-19 周四 00:00
const NOW_FRI = new Date(2026, 10, 20, 0, 0, 0, 0).getTime(); // 2026-11-20 周五 00:00

describe("parseMemoInput (C5-2)", () => {
  it("只识别 #标签，日期时间优先级留在正文", () => {
    const result = parseMemoInput("明天 10:30 开会 !! #工作");

    expect(result.text).toBe("明天 10:30 开会 !!");
    expect(result.tags).toEqual(["工作"]);
    expect(result.dueAt).toBeUndefined();
    expect(result.priority).toBe(0);
    expect(result.tokens).toEqual([
      { kind: "tag", raw: "#工作", label: "#工作" },
    ]);
  });

  it("空输入返回默认值", () => {
    expect(parseMemoInput("")).toEqual({
      text: "",
      dueAt: undefined,
      priority: 0,
      tags: [],
      tokens: [],
    });
  });

  it("重复标签从正文移除但不重复产出 chip", () => {
    const result = parseMemoInput("#a 记录 #a");

    expect(result.text).toBe("记录");
    expect(result.tags).toEqual(["a"]);
    expect(result.tokens).toHaveLength(1);
  });

  it("超过 8 个标签后多余的 #xxx 原样留在正文", () => {
    const result = parseMemoInput("#1 #2 #3 #4 #5 #6 #7 #8 #9");
    const result2 = parseMemoInput("#1 #2 #3 #4 #5 #6 #7 #8 #9");

    expect(result.tags).toHaveLength(8);
    expect(result2.text).toContain("#9");
  });

  it("无标签时正文原样保留", () => {
    expect(parseMemoInput("随便记点什么")).toEqual({
      text: "随便记点什么",
      dueAt: undefined,
      priority: 0,
      tags: [],
      tokens: [],
    });
  });
});
const NOW_EVENING = new Date(2026, 10, 19, 21, 0, 0, 0).getTime(); // 周四 21:00

function at(year: number, month: number, day: number, hour = 0, minute = 0): number {
  return new Date(year, month - 1, day, hour, minute).getTime();
}

describe("parseQuickAdd · 边界与降级", () => {
  it("空串退化成空结果", () => {
    expect(parseQuickAdd("", NOW_THU)).toEqual({
      text: "",
      dueAt: undefined,
      priority: 0,
      tags: [],
      tokens: [],
    });
  });

  it("纯空白同样退化成空结果", () => {
    const result = parseQuickAdd("   \t \u3000  ", NOW_THU);
    expect(result.text).toBe("");
    expect(result.tokens).toEqual([]);
    expect(result.priority).toBe(0);
  });

  it("没有 token 时正文原样返回", () => {
    const result = parseQuickAdd("随便写点什么吧", NOW_THU);
    expect(result.text).toBe("随便写点什么吧");
    expect(result.dueAt).toBeUndefined();
    expect(result.tokens).toEqual([]);
  });

  it("只有 !! 时正文为空、优先级 3", () => {
    const result = parseQuickAdd("!!", NOW_THU);
    expect(result.text).toBe("");
    expect(result.priority).toBe(3);
    expect(result.tokens).toEqual([{ kind: "priority", raw: "!!", label: "高优先级" }]);
  });

  it("单个 ! 是优先级 2", () => {
    const result = parseQuickAdd("!", NOW_THU);
    expect(result.text).toBe("");
    expect(result.priority).toBe(2);
    expect(result.tokens[0].label).toBe("中优先级");
  });

  it("#a #a 去重成一条标签、只产出一颗 chip", () => {
    const result = parseQuickAdd("#a #a", NOW_THU);
    expect(result.tags).toEqual(["a"]);
    expect(result.tokens).toHaveLength(1);
    expect(result.tokens[0]).toEqual({ kind: "tag", raw: "#a", label: "#a" });
    expect(result.text).toBe("");
  });

  it("正文中间夹 token 时按整段移除并收敛空格", () => {
    const result = parseQuickAdd("买牛奶 明天 10:30 回家", NOW_THU);
    expect(result.text).toBe("买牛奶 回家");
    expect(result.dueAt).toBe(at(2026, 11, 20, 10, 30));
    expect(result.tokens.map((t) => t.raw)).toEqual(["明天", "10:30"]);
  });

  it("无效日期不吞输入", () => {
    const result = parseQuickAdd("2026-02-30 开会", NOW_THU);
    expect(result.text).toBe("2026-02-30 开会");
    expect(result.dueAt).toBeUndefined();
  });

  it("无效时间不吞输入", () => {
    const result = parseQuickAdd("25:00 起床", NOW_THU);
    expect(result.text).toBe("25:00 起床");
    expect(result.dueAt).toBeUndefined();
  });

  it("不传 now 也不抛错", () => {
    expect(() => parseQuickAdd("明天 10:30 #工作 !!")).not.toThrow();
  });
});

describe("parseQuickAdd · 日期", () => {
  it("今天落在当天 00:00", () => {
    expect(parseQuickAdd("今天 交周报", NOW_THU).dueAt).toBe(at(2026, 11, 19));
  });

  it("明天 / 后天 / 大后天", () => {
    expect(parseQuickAdd("明天", NOW_THU).dueAt).toBe(at(2026, 11, 20));
    expect(parseQuickAdd("后天", NOW_THU).dueAt).toBe(at(2026, 11, 21));
    expect(parseQuickAdd("大后天", NOW_THU).dueAt).toBe(at(2026, 11, 22));
  });

  it("周五（离周四最近的那个周五）", () => {
    const result = parseQuickAdd("周五 交周报", NOW_THU);
    expect(result.dueAt).toBe(at(2026, 11, 20));
    expect(result.text).toBe("交周报");
  });

  it("周五在周五当天就是今天", () => {
    expect(parseQuickAdd("周五 交周报", NOW_FRI).dueAt).toBe(at(2026, 11, 20));
  });

  it("不写前缀且已过就顺延一周", () => {
    expect(parseQuickAdd("周一", NOW_THU).dueAt).toBe(at(2026, 11, 23));
    expect(parseQuickAdd("周天", NOW_THU).dueAt).toBe(at(2026, 11, 22));
    expect(parseQuickAdd("星期天", NOW_THU).dueAt).toBe(at(2026, 11, 22));
    expect(parseQuickAdd("周七", NOW_THU).dueAt).toBe(at(2026, 11, 22));
  });

  it("本周X 按本周字面算（可能在过去），下周X 顺延一周", () => {
    expect(parseQuickAdd("本周一", NOW_THU).dueAt).toBe(at(2026, 11, 16));
    expect(parseQuickAdd("下周一", NOW_THU).dueAt).toBe(at(2026, 11, 23));
    // 本周是 11/16–11/22，所以下周日是 11/29
    expect(parseQuickAdd("下周日下午3点", NOW_THU).dueAt).toBe(at(2026, 11, 29, 15));
  });

  it("M月D日 取今年", () => {
    expect(parseQuickAdd("12月31日", NOW_THU).dueAt).toBe(at(2026, 12, 31));
    expect(parseQuickAdd("3月5号 交材料", NOW_THU).dueAt).toBe(at(2027, 3, 5));
  });

  it("跨年：已经过去的月日顺延到明年", () => {
    expect(parseQuickAdd("1月2日", NOW_THU).dueAt).toBe(at(2027, 1, 2));
  });

  it("跨月跨年：12 月 31 日之后再看 12 月 1 日", () => {
    const jan5 = new Date(2027, 0, 5).getTime();
    expect(parseQuickAdd("12月1日", jan5).dueAt).toBe(at(2027, 12, 1));
    expect(parseQuickAdd("12月31日", jan5).dueAt).toBe(at(2027, 12, 31));
  });

  it("12月31日 23:59 日期与时间组合", () => {
    const result = parseQuickAdd("12月31日 23:59 跨年倒数", NOW_THU);
    expect(result.dueAt).toBe(at(2026, 12, 31, 23, 59));
    expect(result.text).toBe("跨年倒数");
    expect(result.tokens.map((t) => t.kind)).toEqual(["date", "time"]);
  });

  it("ISO 日期带年份不做顺延", () => {
    expect(parseQuickAdd("2027-03-05", NOW_THU).dueAt).toBe(at(2027, 3, 5));
    expect(parseQuickAdd("2022-05-01 补记", NOW_THU).dueAt).toBe(at(2022, 5, 1));
  });
});

describe("parseQuickAdd · 时间", () => {
  it("只有时间时落在今天", () => {
    expect(parseQuickAdd("10:30", NOW_THU).dueAt).toBe(at(2026, 11, 19, 10, 30));
  });

  it("只有时间且已经过了就落到明天", () => {
    expect(parseQuickAdd("10:30", NOW_EVENING).dueAt).toBe(at(2026, 11, 20, 10, 30));
  });

  it("显式写了今天就不再顺延", () => {
    expect(parseQuickAdd("今天 10点", NOW_EVENING).dueAt).toBe(at(2026, 11, 19, 10));
  });

  it("下午 / 晚上 / 上午 / 中午 的 12 小时制换算", () => {
    expect(parseQuickAdd("下午3点半", NOW_THU).dueAt).toBe(at(2026, 11, 19, 15, 30));
    expect(parseQuickAdd("晚上8点", NOW_THU).dueAt).toBe(at(2026, 11, 19, 20));
    expect(parseQuickAdd("上午10点", NOW_THU).dueAt).toBe(at(2026, 11, 19, 10));
    expect(parseQuickAdd("中午12点", NOW_THU).dueAt).toBe(at(2026, 11, 19, 12));
    expect(parseQuickAdd("凌晨4点", NOW_THU).dueAt).toBe(at(2026, 11, 19, 4));
  });

  it("点 + 分 / 半 / 一刻", () => {
    expect(parseQuickAdd("8点15分", NOW_THU).dueAt).toBe(at(2026, 11, 19, 8, 15));
    expect(parseQuickAdd("8点一刻", NOW_THU).dueAt).toBe(at(2026, 11, 19, 8, 15));
    expect(parseQuickAdd("23:59", NOW_THU).dueAt).toBe(at(2026, 11, 19, 23, 59));
  });

  it("时间 token 的 label 归一成 HH:MM", () => {
    expect(parseQuickAdd("下午3点半", NOW_THU).tokens[0].label).toBe("15:30");
    expect(parseQuickAdd("10:30", NOW_THU).tokens[0].label).toBe("10:30");
  });

  it("明早 = 明天 08:00", () => {
    const result = parseQuickAdd("明早 跑步", NOW_THU);
    expect(result.dueAt).toBe(at(2026, 11, 20, 8));
    expect(result.text).toBe("跑步");
    expect(result.tokens[0]).toEqual({ kind: "date", raw: "明早", label: "明早" });
  });

  it("日期与时间组合按日期当天算", () => {
    expect(parseQuickAdd("明天 下午3点半", NOW_THU).dueAt).toBe(at(2026, 11, 20, 15, 30));
  });
});

describe("parseQuickAdd · 优先级与标签", () => {
  it("优先级与日期同时生效", () => {
    const result = parseQuickAdd("!! 明天 交报告", NOW_THU);
    expect(result.priority).toBe(3);
    expect(result.dueAt).toBe(at(2026, 11, 20));
    expect(result.text).toBe("交报告");
  });

  it("连续感叹号算一个 token", () => {
    const result = parseQuickAdd("紧急!!!", NOW_THU);
    expect(result.priority).toBe(3);
    expect(result.tokens[0].raw).toBe("!!!");
    expect(result.text).toBe("紧急");
  });

  it("标签去重并保序", () => {
    const result = parseQuickAdd("#工作 #生活 #工作", NOW_THU);
    expect(result.tags).toEqual(["工作", "生活"]);
    expect(result.tokens).toHaveLength(2);
    expect(result.text).toBe("");
  });

  it("标签最多 8 个，超出的留在正文里不吞", () => {
    const result = parseQuickAdd("#1 #2 #3 #4 #5 #6 #7 #8 #9", NOW_THU);
    expect(result.tags).toHaveLength(8);
    expect(result.tags).toEqual(["1", "2", "3", "4", "5", "6", "7", "8"]);
    expect(result.text).toBe("#9");
  });

  it("英文与带连字符的标签", () => {
    expect(parseQuickAdd("#home #2026-Q1", NOW_THU).tags).toEqual(["home", "2026-Q1"]);
  });
});

describe("parseQuickAdd · 组合与 token 结构", () => {
  it("日期 + 时间 + 优先级 + 标签的全量解析", () => {
    const result = parseQuickAdd("明天下午3点半 交周报 #工作 !!", NOW_THU);
    expect(result.text).toBe("交周报");
    expect(result.dueAt).toBe(at(2026, 11, 20, 15, 30));
    expect(result.priority).toBe(3);
    expect(result.tags).toEqual(["工作"]);
    // token 顺序跟着原文位置走，chips 才不会跳来跳去
    expect(result.tokens).toEqual([
      { kind: "date", raw: "明天", label: "明天" },
      { kind: "time", raw: "下午3点半", label: "15:30" },
      { kind: "tag", raw: "#工作", label: "#工作" },
      { kind: "priority", raw: "!!", label: "高优先级" },
    ]);
  });

  it("多余的同类型 token 留在正文里", () => {
    const result = parseQuickAdd("明天 后天 开会", NOW_THU);
    expect(result.dueAt).toBe(at(2026, 11, 20));
    expect(result.text).toBe("后天 开会");
  });

  it("token 的 raw 一定能在原输入里原样找到", () => {
    const input = "下周三 上午10点半 体检 #健康 !";
    const result = parseQuickAdd(input, NOW_THU);
    for (const token of result.tokens) {
      expect(input.includes(token.raw)).toBe(true);
    }
  });
});

describe("removeQuickAddToken", () => {
  const parsed = parseQuickAdd("明天下午3点半 交周报 #工作 !!", NOW_THU);

  it("点掉标签后日期、时间、优先级都还在", () => {
    const result = removeQuickAddToken(parsed, 2, NOW_THU);
    expect(result.tags).toEqual([]);
    expect(result.dueAt).toBe(at(2026, 11, 20, 15, 30));
    expect(result.priority).toBe(3);
    expect(result.tokens.map((token) => token.kind)).toEqual(["date", "time", "priority"]);
    expect(result.text).toBe("交周报");
  });

  it("点掉日期后只剩时间，按「今天已过则明天」重算", () => {
    const result = removeQuickAddToken(parsed, 0, NOW_EVENING);
    expect(result.tokens[0].kind).toBe("time");
    expect(result.dueAt).toBe(at(2026, 11, 20, 15, 30));
  });

  it("点掉时间后只剩日期，回到当天 00:00", () => {
    expect(removeQuickAddToken(parsed, 1, NOW_THU).dueAt).toBe(at(2026, 11, 20));
  });

  it("点掉优先级后归零", () => {
    expect(removeQuickAddToken(parsed, 3, NOW_THU).priority).toBe(0);
  });

  it("下标越界原样返回（引用不变）", () => {
    expect(removeQuickAddToken(parsed, 9, NOW_THU)).toBe(parsed);
    expect(removeQuickAddToken(parsed, -1, NOW_THU)).toBe(parsed);
  });

  it("全部点掉后只剩正文", () => {
    let result = parsed;
    for (let i = 0; i < 4; i += 1) result = removeQuickAddToken(result, 0, NOW_THU);
    expect(result).toEqual({ text: "交周报", dueAt: undefined, priority: 0, tags: [], tokens: [] });
  });
});

describe("日期工具函数", () => {
  it("startOfLocalDay 取当天 00:00", () => {
    expect(startOfLocalDay(at(2026, 11, 19, 21, 5))).toBe(at(2026, 11, 19));
  });

  it("addLocalDays 跨月跨年", () => {
    expect(addLocalDays(at(2026, 12, 31), 1)).toBe(at(2027, 1, 1));
    expect(addLocalDays(at(2026, 11, 19), -19)).toBe(at(2026, 10, 31));
  });
});
