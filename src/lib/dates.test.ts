import { describe, expect, it } from "vitest";
import {
  addDays,
  applyTimeOfDay,
  formatDue,
  fromDateInputValue,
  getDueBucket,
  hasTimePart,
  isSameDay,
  startOfDay,
  startOfWeek,
  toDateInputValue,
  toTimeInputValue,
} from "./dates";

/** 固定「现在」：2026-11-19 周四 10:00 本地时间 */
const NOW = new Date(2026, 10, 19, 10, 0, 0, 0).getTime();
const at = (month: number, day: number, hour = 0, minute = 0) =>
  new Date(2026, month - 1, day, hour, minute, 0, 0).getTime();

describe("startOfDay / addDays / startOfWeek", () => {
  it("normalizes to local midnight", () => {
    expect(startOfDay(NOW)).toBe(at(11, 19));
  });

  it("adds calendar days across month boundaries", () => {
    expect(addDays(at(11, 30), 1)).toBe(at(12, 1));
    expect(addDays(at(12, 1), -1)).toBe(at(11, 30));
  });

  it("treats Monday as the first day of the week", () => {
    expect(startOfWeek(NOW)).toBe(at(11, 16)); // 2026-11-19 是周四
    expect(startOfWeek(at(11, 22))).toBe(at(11, 16)); // 周日仍属于本周
    expect(startOfWeek(at(11, 23))).toBe(at(11, 23)); // 周一是新一周
  });

  it("compares calendar days, not timestamps", () => {
    expect(isSameDay(at(11, 19, 0, 1), at(11, 19, 23, 59))).toBe(true);
    expect(isSameDay(at(11, 19, 23, 59), at(11, 20, 0, 0))).toBe(false);
  });
});

describe("getDueBucket", () => {
  it("returns none without a due date", () => {
    expect(getDueBucket(undefined, NOW)).toBe("none");
  });

  it("puts yesterday and earlier into overdue", () => {
    expect(getDueBucket(at(11, 18), NOW)).toBe("overdue");
    expect(getDueBucket(at(11, 18, 23, 59), NOW)).toBe("overdue");
  });

  it("detects today and tomorrow at any hour", () => {
    expect(getDueBucket(at(11, 19, 0, 0), NOW)).toBe("today");
    expect(getDueBucket(at(11, 19, 23, 59), NOW)).toBe("today");
    expect(getDueBucket(at(11, 20, 0, 0), NOW)).toBe("tomorrow");
  });

  it("groups the rest of this week and pushes next week to later", () => {
    expect(getDueBucket(at(11, 21), NOW)).toBe("thisWeek");
    expect(getDueBucket(at(11, 22), NOW)).toBe("thisWeek");
    expect(getDueBucket(at(11, 23), NOW)).toBe("later");
  });
});

describe("formatDue", () => {
  it("returns an empty string without a due date", () => {
    expect(formatDue(undefined, NOW)).toBe("");
  });

  it("labels overdue with the date so color is never the only signal", () => {
    expect(formatDue(at(11, 18), NOW)).toBe("逾期 · 11月18日");
    expect(formatDue(at(11, 18, 9, 30), NOW)).toBe("逾期 · 11月18日 09:30");
  });

  it("uses relative words for today and tomorrow", () => {
    expect(formatDue(at(11, 19), NOW)).toBe("今天");
    expect(formatDue(at(11, 19, 18, 5), NOW)).toBe("今天 18:05");
    expect(formatDue(at(11, 20), NOW)).toBe("明天");
  });

  it("uses weekday inside this week and a date later on", () => {
    expect(formatDue(at(11, 21), NOW)).toBe("周六");
    expect(formatDue(at(11, 30), NOW)).toBe("11月30日");
  });

  it("includes the year when it differs from now", () => {
    expect(formatDue(new Date(2027, 0, 5, 0, 0).getTime(), NOW)).toBe("2027年1月5日");
  });
});

describe("date input helpers", () => {
  it("round-trips a local date", () => {
    const value = toDateInputValue(at(11, 19));
    expect(value).toBe("2026-11-19");
    expect(fromDateInputValue(value)).toBe(at(11, 19));
  });

  it("rejects malformed or impossible dates", () => {
    expect(fromDateInputValue("")).toBeUndefined();
    expect(fromDateInputValue("2026-2-3")).toBeUndefined();
    expect(fromDateInputValue("2026-02-30")).toBeUndefined();
    expect(fromDateInputValue("2026-13-01")).toBeUndefined();
  });

  it("detects whether a due timestamp carries a time part", () => {
    expect(hasTimePart(at(11, 19))).toBe(false);
    expect(hasTimePart(at(11, 19, 0, 1))).toBe(true);
    expect(toTimeInputValue(at(11, 19, 8, 3))).toBe("08:03");
    expect(toTimeInputValue(at(11, 19))).toBe("");
  });

  it("applies a time of day and falls back to midnight", () => {
    expect(applyTimeOfDay(at(11, 19), "18:30")).toBe(at(11, 19, 18, 30));
    expect(applyTimeOfDay(at(11, 19), "")).toBe(at(11, 19));
    expect(applyTimeOfDay(at(11, 19), "99:99")).toBe(at(11, 19));
  });
});
