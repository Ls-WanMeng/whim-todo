import { describe, expect, it } from "vitest";
import {
  WEEKDAY_LABELS,
  firstRepeatDueAt,
  matchesDay,
  nextRepeatDay,
  nextRepeatDueAt,
  normalizeRepeat,
  repeatLabel,
  weekdayIndex,
} from "./repeat";

/** 固定参照时刻，绝不依赖真实时间：2026-11-16 周一 … 2026-11-22 周日 */
function at(month: number, day: number, hour = 0, minute = 0): number {
  return new Date(2026, month - 1, day, hour, minute).getTime();
}

const MON = 16;
const THU = 19;
const FRI = 20;
const SAT = 21;
const SUN = 22;

describe("normalizeRepeat", () => {
  it("三种合法规则原样保留", () => {
    expect(normalizeRepeat({ kind: "daily" })).toEqual({ kind: "daily" });
    expect(normalizeRepeat({ kind: "weekdays" })).toEqual({ kind: "weekdays" });
    expect(normalizeRepeat({ kind: "weekly", weekday: 0 })).toEqual({ kind: "weekly", weekday: 0 });
    expect(normalizeRepeat({ kind: "weekly", weekday: 6 })).toEqual({ kind: "weekly", weekday: 6 });
  });

  it("weekly 的星期序号越界或不是整数就丢弃", () => {
    expect(normalizeRepeat({ kind: "weekly", weekday: 7 })).toBeUndefined();
    expect(normalizeRepeat({ kind: "weekly", weekday: -1 })).toBeUndefined();
    expect(normalizeRepeat({ kind: "weekly", weekday: 1.5 })).toBeUndefined();
    expect(normalizeRepeat({ kind: "weekly", weekday: "1" })).toBeUndefined();
  });

  it("未知 kind / 非对象 / null 都回落到不重复", () => {
    expect(normalizeRepeat({ kind: "monthly" })).toBeUndefined();
    expect(normalizeRepeat("daily")).toBeUndefined();
    expect(normalizeRepeat(null)).toBeUndefined();
    expect(normalizeRepeat(undefined)).toBeUndefined();
  });

  it("不额外挂字段，方便导出后逐字节比对", () => {
    expect(normalizeRepeat({ kind: "daily", extra: 1 })).toEqual({ kind: "daily" });
  });
});

describe("repeatLabel", () => {
  it("三种规则的中文文案", () => {
    expect(repeatLabel({ kind: "daily" })).toBe("每天");
    expect(repeatLabel({ kind: "weekdays" })).toBe("工作日");
    expect(repeatLabel({ kind: "weekly", weekday: 0 })).toBe("每周一");
    expect(repeatLabel({ kind: "weekly", weekday: 6 })).toBe("每周日");
  });

  it("没有规则时是空串（任务行据此不渲染标记）", () => {
    expect(repeatLabel()).toBe("");
  });

  it("七个星期标签齐全且从周一起算", () => {
    expect(WEEKDAY_LABELS).toHaveLength(7);
    expect(WEEKDAY_LABELS[0]).toBe("周一");
    expect(WEEKDAY_LABELS[6]).toBe("周日");
  });
});

describe("weekdayIndex", () => {
  it("0 = 周一 … 6 = 周日", () => {
    expect(weekdayIndex(at(11, MON))).toBe(0);
    expect(weekdayIndex(at(11, THU))).toBe(3);
    expect(weekdayIndex(at(11, SUN))).toBe(6);
  });
});

describe("matchesDay", () => {
  it("每天命中任意一天", () => {
    for (const day of [MON, THU, SUN]) {
      expect(matchesDay({ kind: "daily" }, at(11, day))).toBe(true);
    }
  });

  it("工作日只命中周一到周五", () => {
    expect(matchesDay({ kind: "weekdays" }, at(11, MON))).toBe(true);
    expect(matchesDay({ kind: "weekdays" }, at(11, FRI))).toBe(true);
    expect(matchesDay({ kind: "weekdays" }, at(11, SAT))).toBe(false);
    expect(matchesDay({ kind: "weekdays" }, at(11, SUN))).toBe(false);
  });

  it("每周X 只命中那一天", () => {
    expect(matchesDay({ kind: "weekly", weekday: 0 }, at(11, MON))).toBe(true);
    expect(matchesDay({ kind: "weekly", weekday: 0 }, at(11, THU))).toBe(false);
    expect(matchesDay({ kind: "weekly", weekday: 6 }, at(11, SUN))).toBe(true);
  });
});

describe("nextRepeatDay", () => {
  it("每天就是第二天", () => {
    expect(nextRepeatDay({ kind: "daily" }, at(11, THU))).toBe(at(11, FRI));
  });

  it("工作日逢周五跳到周一", () => {
    expect(nextRepeatDay({ kind: "weekdays" }, at(11, FRI))).toBe(at(11, MON + 7));
  });

  it("周末不会被算作工作日", () => {
    expect(nextRepeatDay({ kind: "weekdays" }, at(11, SAT))).toBe(at(11, MON + 7));
  });

  it("每周X 严格晚于基准日，同一天不会原地返回", () => {
    expect(nextRepeatDay({ kind: "weekly", weekday: 0 }, at(11, MON))).toBe(at(11, MON + 7));
    expect(nextRepeatDay({ kind: "weekly", weekday: 0 }, at(11, THU))).toBe(at(11, MON + 7));
  });
});

describe("nextRepeatDueAt", () => {
  it("每天 8 点：当天完成，下一条是明天 8 点", () => {
    const now = at(11, FRI, 8, 5);
    expect(nextRepeatDueAt({ kind: "daily" }, now, at(11, FRI, 8, 0))).toBe(at(11, SAT, 8, 0));
  });

  it("提前完成时以「原截止日」为基准，不生成跟原截止日撞车的一条", () => {
    const now = at(11, THU, 20, 0);
    // 原截止日是明天 8 点，今天先完成了
    expect(nextRepeatDueAt({ kind: "daily" }, now, at(11, FRI, 8, 0))).toBe(at(11, SAT, 8, 0));
  });

  it("补做逾期任务：以完成日为基准往后推一天", () => {
    const now = at(11, THU, 12, 0);
    // 原截止日是上周一（逾期）
    expect(nextRepeatDueAt({ kind: "daily" }, now, at(11, MON, 8, 0))).toBe(at(11, FRI, 8, 0));
  });

  it("每周一 9 点：周四完成，下一条是下周一 9 点", () => {
    expect(nextRepeatDueAt({ kind: "weekly", weekday: 0 }, at(11, THU, 10, 0), at(11, MON, 9, 0))).toBe(
      at(11, MON + 7, 9, 0),
    );
  });

  it("每周一 9 点：当天（周一）完成，下一条是下周一而不是今天", () => {
    expect(nextRepeatDueAt({ kind: "weekly", weekday: 0 }, at(11, MON, 9, 30), at(11, MON, 9, 0))).toBe(
      at(11, MON + 7, 9, 0),
    );
  });

  it("工作日 9 点：周五完成跳到下周一 9 点", () => {
    expect(nextRepeatDueAt({ kind: "weekdays" }, at(11, FRI, 18, 0), at(11, FRI, 9, 0))).toBe(
      at(11, MON + 7, 9, 0),
    );
  });

  it("没有截止时间的任务：下一条落在次日 00:00", () => {
    expect(nextRepeatDueAt({ kind: "daily" }, at(11, THU, 21, 0), undefined)).toBe(at(11, FRI, 0, 0));
  });

  it("跨月跨年由日历处理", () => {
    expect(nextRepeatDueAt({ kind: "daily" }, at(12, 31, 22, 0), undefined)).toBe(
      new Date(2027, 0, 1).getTime(),
    );
  });

  it("不改动入参（纯函数）", () => {
    const now = at(11, THU, 12, 0);
    const due = at(11, THU, 8, 0);
    nextRepeatDueAt({ kind: "daily" }, now, due);
    expect(now).toBe(at(11, THU, 12, 0));
    expect(due).toBe(at(11, THU, 8, 0));
  });
});

describe("firstRepeatDueAt", () => {
  it("每天 8 点、还没到点：首次落在今天 8 点", () => {
    expect(firstRepeatDueAt({ kind: "daily" }, at(11, THU, 6, 0), at(11, THU, 8, 0))).toBe(
      at(11, THU, 8, 0),
    );
  });

  it("每天 8 点、已经过点：首次落在明天 8 点", () => {
    expect(firstRepeatDueAt({ kind: "daily" }, at(11, THU, 20, 0), at(11, THU, 8, 0))).toBe(
      at(11, FRI, 8, 0),
    );
  });

  it("每周日 20 点：周四当天算出周日 20 点", () => {
    expect(firstRepeatDueAt({ kind: "weekly", weekday: 6 }, at(11, THU, 10, 0), at(11, THU, 20, 0))).toBe(
      at(11, SUN, 20, 0),
    );
  });

  it("每周日 20 点、周日当晚已过点：落到下周", () => {
    expect(firstRepeatDueAt({ kind: "weekly", weekday: 6 }, at(11, SUN, 21, 0), at(11, SUN, 20, 0))).toBe(
      at(11, SUN + 7, 20, 0),
    );
  });

  it("每周一 9 点、周日创建：首次就是明天", () => {
    expect(firstRepeatDueAt({ kind: "weekly", weekday: 0 }, at(11, SUN, 12, 0), at(11, SUN, 9, 0))).toBe(
      at(11, MON + 7, 9, 0),
    );
  });

  it("工作日 9 点半、周五中午创建：跳到下周一", () => {
    expect(firstRepeatDueAt({ kind: "weekdays" }, at(11, FRI, 12, 0), at(11, FRI, 9, 30))).toBe(
      at(11, MON + 7, 9, 30),
    );
  });

  it("没有钟点原型时落在 00:00", () => {
    expect(firstRepeatDueAt({ kind: "daily" }, at(11, THU, 21, 0), undefined)).toBe(at(11, FRI, 0, 0));
  });
});
