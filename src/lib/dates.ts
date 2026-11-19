/*
 * 日期工具：全部按本地时区计算，只处理「天」与「到日期的时刻」两种粒度。
 * 约定：只到日期的 dueAt 存当天 00:00 的本地时间戳；带时间的 dueAt 存具体时刻。
 */

export const DAY_MS = 24 * 60 * 60 * 1000;

export type DueBucket = "overdue" | "today" | "tomorrow" | "thisWeek" | "later" | "none";

export const DUE_BUCKET_ORDER: DueBucket[] = [
  "overdue",
  "today",
  "tomorrow",
  "thisWeek",
  "later",
  "none",
];

export const DUE_BUCKET_LABELS: Record<DueBucket, string> = {
  overdue: "逾期",
  today: "今天",
  tomorrow: "明天",
  thisWeek: "本周",
  later: "以后",
  none: "无日期",
};

const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

export function startOfDay(ts: number): number {
  const date = new Date(ts);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/** 在本地日历上加减天数，用 setDate 避开夏令时导致的 23/25 小时偏差 */
export function addDays(ts: number, days: number): number {
  const date = new Date(ts);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date.getTime();
}

export function startOfWeek(ts: number): number {
  const day = new Date(startOfDay(ts)).getDay();
  const offset = (day + 6) % 7; // 周一为一周之首
  return addDays(ts, -offset);
}

export function isSameDay(a: number, b: number): boolean {
  return startOfDay(a) === startOfDay(b);
}

export function hasTimePart(dueAt: number): boolean {
  return dueAt !== startOfDay(dueAt);
}

export function getDueBucket(dueAt: number | undefined, now = Date.now()): DueBucket {
  if (dueAt === undefined) return "none";

  const today = startOfDay(now);
  if (dueAt < today) return "overdue";
  if (dueAt < addDays(today, 1)) return "today";
  if (dueAt < addDays(today, 2)) return "tomorrow";
  if (dueAt < addDays(startOfWeek(today), 7)) return "thisWeek";
  return "later";
}

export function isOverdue(dueAt: number | undefined, now = Date.now()): boolean {
  return getDueBucket(dueAt, now) === "overdue";
}

export function formatTime(ts: number): string {
  const date = new Date(ts);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function formatDateShort(ts: number, now = Date.now()): string {
  const date = new Date(ts);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  if (date.getFullYear() !== new Date(now).getFullYear()) {
    return `${date.getFullYear()}年${month}月${day}日`;
  }
  return `${month}月${day}日`;
}

/** 列表里的截止时间文案；无日期返回空串 */
export function formatDue(dueAt: number | undefined, now = Date.now()): string {
  if (dueAt === undefined) return "";

  const time = hasTimePart(dueAt) ? ` ${formatTime(dueAt)}` : "";
  switch (getDueBucket(dueAt, now)) {
    case "overdue":
      return `逾期 · ${formatDateShort(dueAt, now)}${time}`;
    case "today":
      return `今天${time}`;
    case "tomorrow":
      return `明天${time}`;
    case "thisWeek":
      return `${WEEKDAYS[new Date(dueAt).getDay()]}${time}`;
    case "later":
      return `${formatDateShort(dueAt, now)}${time}`;
    default:
      return "";
  }
}

/** input[type=date] 需要的本地 YYYY-MM-DD */
export function toDateInputValue(ts: number | undefined): string {
  if (ts === undefined) return "";
  const date = new Date(ts);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** 解析本地 YYYY-MM-DD；非法输入返回 undefined */
export function fromDateInputValue(value: string): number | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return undefined;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day, 0, 0, 0, 0);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return undefined;
  }
  return date.getTime();
}

/** input[type=time] 需要的本地 HH:mm；无时间部分返回空串 */
export function toTimeInputValue(ts: number | undefined): string {
  if (ts === undefined || !hasTimePart(ts)) return "";
  return formatTime(ts);
}

/** 把 HH:mm 应用到某一天；空串表示回到 00:00 */
export function applyTimeOfDay(dayTs: number, time: string): number {
  const match = /^(\d{2}):(\d{2})$/.exec(time.trim());
  const date = new Date(startOfDay(dayTs));
  if (!match) return date.getTime();

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return date.getTime();

  date.setHours(hours, minutes, 0, 0);
  return date.getTime();
}
