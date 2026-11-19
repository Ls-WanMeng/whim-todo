/**
 * C3 · 自然语言快速添加解析器（纯函数，零依赖）
 *
 * 目标：把「明天下午3点半 交周报 #工作 !!」这类输入拆成
 *   - text：去掉 token 后的正文
 *   - dueAt / priority / tags：可直接写进 Todo 的字段
 *   - tokens：供 QuickAddChips 展示、逐个点掉的识别项
 *
 * 设计约定（与 App 的接线有关，改动前请先看测试）：
 *   1. 只识别「首个」日期 / 时间 / 优先级 token，多余的同类型写法留在正文里，
 *      宁可留着让用户看见，也不静默吞掉输入。
 *   2. 同名标签重复出现时从正文移除但不产出 chip（tags 本来就只留一份）；
 *      超过 8 个不同标签后，多余的 #xxx 原样留在正文。
 *   3. 任何解析失败都退化成「纯文本 + 默认值」，本函数不会抛错。
 *   4. 日期一律落在本地时区的当天 00:00；带时间点时为该时刻的 ms。
 */

/** 识别项类别：日期 / 时间 / 优先级 / 标签 */
export type QuickAddTokenKind = "date" | "time" | "priority" | "tag";

export type QuickAddToken = {
  kind: QuickAddTokenKind;
  /** 原文片段，用于从输入里整段移除、以及在需要时还原 */
  raw: string;
  /** 展示用文案：日期保留原写法，时间归一成 HH:MM，优先级给中文，标签带 # */
  label: string;
};

export type ParsedQuickAdd = {
  /** 移除 token 后的正文（可能为空串） */
  text: string;
  /** 本地时区的到期时刻；只有日期时为当天 00:00，无日期无时间为 undefined */
  dueAt?: number;
  priority: 0 | 1 | 2 | 3;
  /** 去重、保序、最多 8 个 */
  tags: string[];
  tokens: QuickAddToken[];
};

const MAX_TAGS = 8;
/** 「明早」这类只给到半天粒度的写法，默认落在早上 8 点 */
const DEFAULT_MORNING_MINUTES = 8 * 60;
const MINUTE_MS = 60_000;

/** 一周从周一开始：0=周一 … 6=周日（与中文习惯一致） */
const WEEKDAY_BY_CHAR: Record<string, number> = {
  一: 0, 二: 1, 三: 2, 四: 3, 五: 4, 六: 5, 日: 6, 天: 6, 七: 6,
  "1": 0, "2": 1, "3": 2, "4": 3, "5": 4, "6": 5, "7": 6,
};

/** 相对日：offset 为「今天起第几天」 */
const RELATIVE_DAY: Record<string, number> = {
  今天: 0, 今日: 0, 明天: 1, 明日: 1, 后天: 2, 大后天: 3,
};

/** 带前缀的小时转 24 小时制；非法组合返回 null（当作没识别到） */
function to24Hour(hour: number, prefix?: string): number | null {
  if (!prefix) return hour >= 0 && hour <= 23 ? hour : null;
  if (hour < 1 || hour > 12) return null;

  if (prefix === "凌晨") return hour === 12 ? 0 : hour;
  if (prefix === "上午" || prefix === "早上" || prefix === "早晨") return hour;
  // 中午 1 点 = 13:00，中午 12 点 = 12:00
  if (prefix === "中午") return hour < 11 ? hour + 12 : 12;
  // 下午 / 晚上 / 夜里：12 点仍是 12 点
  return hour < 12 ? hour + 12 : 12;
}

/** 本地时区某天 00:00 的 ms（DST 安全：按日历字段构造，不做毫秒减法） */
export function startOfLocalDay(ms: number): number {
  const date = new Date(ms);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** 按日历日加减，跨月跨年由 Date 自己处理 */
export function addLocalDays(ms: number, days: number): number {
  const date = new Date(ms);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days).getTime();
}

/** 校验并构造本地日期；2 月 30 日这类会被 Date 顺延，用回读比对拦掉 */
function localDate(year: number, month: number, day: number): number | null {
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date.getTime();
}

/** 候选命中，start/end 是它在原文里的区间 */
type Candidate = {
  kind: QuickAddTokenKind;
  start: number;
  end: number;
  label: string;
  /** 日期：当天 00:00 的 ms */
  dayAt?: number;
  /** 日期自带的隐含时刻（明早 → 08:00） */
  dayMinutes?: number;
  /** 时间：当天 0 点起的分钟数 */
  minutes?: number;
  priority?: 0 | 1 | 2 | 3;
  tag?: string;
};

function collectDates(source: string, todayStart: number, today: Date, out: Candidate[]): void {
  const year = today.getFullYear();

  for (const match of source.matchAll(/(大后天|后天|明天|明日|今天|今日)/g)) {
    const raw = match[0];
    const offset = RELATIVE_DAY[raw];
    if (offset === undefined) continue;
    const start = match.index ?? 0;
    out.push({
      kind: "date",
      start,
      end: start + raw.length,
      label: raw,
      dayAt: addLocalDays(todayStart, offset),
    });
  }

  // 「明早」= 明天 08:00，属于日期 + 隐含时刻
  for (const match of source.matchAll(/明早/g)) {
    const start = match.index ?? 0;
    out.push({
      kind: "date",
      start,
      end: start + 2,
      label: "明早",
      dayAt: addLocalDays(todayStart, 1),
      dayMinutes: DEFAULT_MORNING_MINUTES,
    });
  }

  for (const match of source.matchAll(/(本|下)?(?:周|星期|礼拜)([一二三四五六日天七1-7])/g)) {
    const prefix = match[1];
    const target = WEEKDAY_BY_CHAR[match[2]];
    if (target === undefined) continue;

    const mondayIndex = (today.getDay() + 6) % 7;
    let delta = target - mondayIndex;
    if (prefix === "下") delta += 7;
    // 不写前缀时取「最近的那个」：今天就是今天，过了就顺延一周
    else if (prefix === undefined && delta < 0) delta += 7;

    const start = match.index ?? 0;
    out.push({
      kind: "date",
      start,
      end: start + match[0].length,
      label: match[0],
      dayAt: addLocalDays(todayStart, delta),
    });
  }

  for (const match of source.matchAll(/(\d{1,2})月(\d{1,2})(?:日|号)/g)) {
    const month = Number(match[1]);
    const day = Number(match[2]);
    let at = localDate(year, month, day);
    if (at === null) continue;
    // 已经过去的月日按明年算（12 月 31 日的「跨年」就靠这条）
    if (at < todayStart) at = localDate(year + 1, month, day);
    if (at === null) continue;

    const start = match.index ?? 0;
    out.push({
      kind: "date",
      start,
      end: start + match[0].length,
      label: match[0],
      dayAt: at,
    });
  }

  // ISO 日期带年份，不做顺延
  for (const match of source.matchAll(/(\d{4})-(\d{1,2})-(\d{1,2})/g)) {
    const at = localDate(Number(match[1]), Number(match[2]), Number(match[3]));
    if (at === null) continue;

    const start = match.index ?? 0;
    out.push({
      kind: "date",
      start,
      end: start + match[0].length,
      label: match[0],
      dayAt: at,
    });
  }
}

function collectTimes(source: string, out: Candidate[]): void {
  const prefixes = "(上午|下午|晚上|夜里|夜间|早上|早晨|中午|凌晨)?";

  // 10:30 / 下午15:20（全角冒号一起认）
  for (const match of source.matchAll(new RegExp(`${prefixes}(\\d{1,2})[:：](\\d{2})`, "g"))) {
    const hour = to24Hour(Number(match[2]), match[1] ?? undefined);
    const minute = Number(match[3]);
    if (hour === null || minute < 0 || minute > 59) continue;

    const start = match.index ?? 0;
    out.push({
      kind: "time",
      start,
      end: start + match[0].length,
      label: formatClock(hour, minute),
      minutes: hour * 60 + minute,
    });
  }

  // 上午10点 / 下午3点半 / 晚上8点 / 8点15 / 8点一刻
  for (const match of source.matchAll(
    new RegExp(`${prefixes}(\\d{1,2})点(半|一刻|(\\d{1,2})分?)?`, "g"),
  )) {
    const hour = to24Hour(Number(match[2]), match[1] ?? undefined);
    if (hour === null) continue;

    const tail = match[3];
    let minute = 0;
    if (tail === "半") minute = 30;
    else if (tail === "一刻") minute = 15;
    else if (tail !== undefined) minute = Number(match[4]);
    if (!Number.isFinite(minute) || minute < 0 || minute > 59) continue;

    const start = match.index ?? 0;
    out.push({
      kind: "time",
      start,
      end: start + match[0].length,
      label: formatClock(hour, minute),
      minutes: hour * 60 + minute,
    });
  }
}

function formatClock(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/**
 * 解析自然语言快速添加。
 * @param input 用户输入
 * @param now 参照时刻（测试请传固定值）；非法值回落到 Date.now()
 */
export function parseQuickAdd(input: string, now?: number): ParsedQuickAdd {
  const source = typeof input === "string" ? input : "";
  const base = typeof now === "number" && Number.isFinite(now) ? now : Date.now();
  const todayStart = startOfLocalDay(base);
  const today = new Date(todayStart);

  const candidates: Candidate[] = [];
  collectDates(source, todayStart, today, candidates);
  collectTimes(source, candidates);

  // 优先级：!! → 3，! → 2（连续感叹号整段算一个 token，!!! 仍是最紧急）
  for (const match of source.matchAll(/!+/g)) {
    const start = match.index ?? 0;
    const level: 0 | 1 | 2 | 3 = match[0].length >= 2 ? 3 : 2;
    candidates.push({
      kind: "priority",
      start,
      end: start + match[0].length,
      label: level === 3 ? "高优先级" : "中优先级",
      priority: level,
    });
  }

  // 标签：#工作 / #a_b / #2026-Q1
  for (const match of source.matchAll(/#([\w\u4e00-\u9fff-]+)/g)) {
    const start = match.index ?? 0;
    candidates.push({
      kind: "tag",
      start,
      end: start + match[0].length,
      label: `#${match[1]}`,
      tag: match[1],
    });
  }

  // 左到右处理，长的优先：先到先得，重叠的一律放弃
  candidates.sort((a, b) => a.start - b.start || b.end - a.end);

  const accepted: { start: number; end: number }[] = [];
  const tokens: QuickAddToken[] = [];
  const tags: string[] = [];
  const tagSet = new Set<string>();

  let dateAt: number | undefined;
  let dateMinutes: number | undefined;
  let timeMinutes: number | undefined;
  let priority: 0 | 1 | 2 | 3 = 0;

  for (const candidate of candidates) {
    const overlap = accepted.some((r) => candidate.start < r.end && candidate.end > r.start);
    if (overlap) continue;

    if (candidate.kind === "date") {
      if (dateAt !== undefined) continue;
      dateAt = candidate.dayAt;
      dateMinutes = candidate.dayMinutes;
    } else if (candidate.kind === "time") {
      if (timeMinutes !== undefined) continue;
      timeMinutes = candidate.minutes;
    } else if (candidate.kind === "priority") {
      if (priority !== 0) continue;
      priority = candidate.priority ?? 0;
    } else {
      const name = candidate.tag ?? "";
      if (!name) continue;
      // 重复标签：正文里删掉，但不重复产出 chip
      if (tagSet.has(name)) {
        accepted.push({ start: candidate.start, end: candidate.end });
        continue;
      }
      if (tags.length >= MAX_TAGS) continue;
      tagSet.add(name);
      tags.push(name);
    }

    accepted.push({ start: candidate.start, end: candidate.end });
    tokens.push({
      kind: candidate.kind,
      raw: source.slice(candidate.start, candidate.end),
      label: candidate.label,
    });
  }

  let dueAt: number | undefined;
  if (dateAt !== undefined) {
    dueAt = dateAt + (timeMinutes ?? dateMinutes ?? 0) * MINUTE_MS;
  } else if (timeMinutes !== undefined) {
    // 只有时间：落在今天，已经过了就明天
    const todayAt = todayStart + timeMinutes * MINUTE_MS;
    dueAt = todayAt <= base ? addLocalDays(todayStart, 1) + timeMinutes * MINUTE_MS : todayAt;
  }

  return {
    text: cleanText(source, accepted),
    dueAt,
    priority,
    tags,
    tokens,
  };
}

/** 把 token 区间从正文里摘掉，并收敛因此产生的多余空格 */
function cleanText(source: string, ranges: { start: number; end: number }[]): string {
  if (ranges.length === 0) return source.trim();

  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  let out = "";
  let cursor = 0;
  for (const range of sorted) {
    if (range.start > cursor) out += source.slice(cursor, range.start);
    cursor = Math.max(cursor, range.end);
  }
  out += source.slice(cursor);

  return out.replace(/[\s\u3000]+/g, " ").trim();
}

/**
 * C5-2 · 备忘模式解析（纯函数）
 *
 * 与 parseQuickAdd 的唯一区别：只识别 #标签。
 * 日期、时间、优先级 token 一律留在正文，不产生对应 chips —— 备忘不需要排期。
 */
export function parseMemoInput(input: string): ParsedQuickAdd {
  const source = typeof input === "string" ? input : "";

  const tokens: QuickAddToken[] = [];
  const tags: string[] = [];
  const tagSet = new Set<string>();
  const accepted: { start: number; end: number }[] = [];

  for (const match of source.matchAll(/#([\w\u4e00-\u9fff-]+)/g)) {
    const name = match[1];
    if (!name) continue;
    const start = match.index ?? 0;
    const end = start + match[0].length;

    // 重复标签：从正文移除但不重复产出 chip（与 parseQuickAdd 行为一致）
    if (tagSet.has(name)) {
      accepted.push({ start, end });
      continue;
    }
    if (tags.length >= MAX_TAGS) continue; // 超出上限原样留在正文

    tagSet.add(name);
    tags.push(name);
    accepted.push({ start, end });
    tokens.push({ kind: "tag", raw: match[0], label: `#${name}` });
  }

  return {
    text: cleanText(source, accepted),
    dueAt: undefined,
    priority: 0,
    tags,
    tokens,
  };
}
/**
 * 点掉第 index 个识别项（QuickAddChips 的删除按钮）之后的结果。
 *
 * 正文不用动：token 早已从正文移除；只有 dueAt / priority / tags 需要按「剩下的 token」重算。
 * 做法是把剩下 token 的原文重新拼一遍再解析 —— 这些 token 本来互不重叠，拼回去语义一致，
 * 也就避免了宿主自己去推导「去了日期只剩时间该怎么算」这类规则。
 *
 * 下标越界时原样返回（引用不变，宿主可以直接 setState）。
 */
export function removeQuickAddToken(
  parsed: ParsedQuickAdd,
  index: number,
  now?: number,
): ParsedQuickAdd {
  const tokens = parsed.tokens.filter((_, i) => i !== index);
  if (tokens.length === parsed.tokens.length) return parsed;

  const reparsed = parseQuickAdd(tokens.map((token) => token.raw).join(" "), now);

  return {
    text: parsed.text,
    dueAt: reparsed.dueAt,
    priority: reparsed.priority,
    tags: reparsed.tags,
    tokens,
  };
}
