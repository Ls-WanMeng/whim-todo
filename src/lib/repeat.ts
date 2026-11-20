/**
 * C6 · 重复规则（纯函数，零依赖）
 *
 * 只有三种规则：每天 / 工作日 / 每周X。存成 `{ kind, weekday }`，
 * weekday 与 quickAdd 的「每周X」一致：0 = 周一 … 6 = 周日。
 *
 * 两个「下一次」口径（都按本地日历算，跨月跨年由 Date 处理）：
 *   - nextRepeatDueAt：严格晚于基准日，用于「完成当前这条后生成下一条」；
 *   - firstRepeatDueAt：从今天起（含今天），用于模板一键套用时的首个截止时间。
 */
import { addDays, startOfDay } from "./dates";

export type RepeatRule =
  | { kind: "daily" }
  | { kind: "weekdays" }
  | { kind: "weekly"; weekday: number };

export const WEEKDAY_LABELS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

/** 本地日历的星期序号：0 = 周一 … 6 = 周日 */
export function weekdayIndex(ts: number): number {
  return (new Date(ts).getDay() + 6) % 7;
}

/** 校验存储 / 导入里的 repeat 字段；非法值一律丢弃（老数据没有这个字段就是 undefined） */
export function normalizeRepeat(value: unknown): RepeatRule | undefined {
  if (!value || typeof value !== "object") return undefined;

  const record = value as Record<string, unknown>;
  if (record.kind === "daily") return { kind: "daily" };
  if (record.kind === "weekdays") return { kind: "weekdays" };
  if (record.kind === "weekly") {
    const weekday = record.weekday;
    if (typeof weekday !== "number" || !Number.isInteger(weekday)) return undefined;
    if (weekday < 0 || weekday > 6) return undefined;
    return { kind: "weekly", weekday };
  }
  return undefined;
}

/** 展示文案：每天 / 工作日 / 每周一；无规则返回空串 */
export function repeatLabel(rule?: RepeatRule): string {
  if (!rule) return "";
  if (rule.kind === "daily") return "每天";
  if (rule.kind === "weekdays") return "工作日";
  return `每${WEEKDAY_LABELS[rule.weekday] ?? WEEKDAY_LABELS[0]}`;
}

/** 这条规则是否命中某一天（dayTs 只要是当天任意时刻即可） */
export function matchesDay(rule: RepeatRule, dayTs: number): boolean {
  const index = weekdayIndex(dayTs);
  if (rule.kind === "daily") return true;
  if (rule.kind === "weekdays") return index <= 4;
  return index === rule.weekday;
}

/** 把钟点盖到某一天上（按日历字段构造，不做毫秒加减） */
function withClock(dayTs: number, hour: number, minute: number): number {
  const date = new Date(dayTs);
  date.setHours(hour, minute, 0, 0);
  return date.getTime();
}

/** 只取 dueAt 的钟点；没有截止时间就落在 00:00 */
function clockOf(dueAt?: number): { hour: number; minute: number } {
  if (dueAt === undefined) return { hour: 0, minute: 0 };
  const date = new Date(dueAt);
  return { hour: date.getHours(), minute: date.getMinutes() };
}

/** 基准日之后（严格大于）的第一个命中日 */
export function nextRepeatDay(rule: RepeatRule, baseDay: number): number {
  for (let offset = 1; offset <= 7; offset += 1) {
    const day = addDays(baseDay, offset);
    if (matchesDay(rule, day)) return day;
  }
  return addDays(baseDay, 1);
}

/**
 * 完成一条重复任务后，下一条的到期时刻。
 * 基准取「完成日」与「原截止日」里更晚的那天：提前完成不会生成一条跟原截止日撞车的实例。
 * 钟点沿用原 dueAt；原条目没有日期时落在当天 00:00。
 */
export function nextRepeatDueAt(rule: RepeatRule, fromAt: number, dueAt?: number): number {
  const fromDay = startOfDay(fromAt);
  const dueDay = dueAt === undefined ? fromDay : startOfDay(dueAt);
  const base = Math.max(fromDay, dueDay);
  const { hour, minute } = clockOf(dueAt);
  return withClock(nextRepeatDay(rule, base), hour, minute);
}

/**
 * 从 now 起（含今天）最近一次命中的到期时刻。
 * dueAtPrototype 只用来取钟点（模板里解析出的「今天 20:00」就够）。
 */
export function firstRepeatDueAt(rule: RepeatRule, now: number, dueAtPrototype?: number): number {
  const today = startOfDay(now);
  const { hour, minute } = clockOf(dueAtPrototype);

  for (let offset = 0; offset <= 7; offset += 1) {
    const day = addDays(today, offset);
    if (!matchesDay(rule, day)) continue;
    const at = withClock(day, hour, minute);
    if (at > now) return at;
  }

  return withClock(nextRepeatDay(rule, today), hour, minute);
}
