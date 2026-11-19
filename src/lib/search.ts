/**
 * C4 · 任务搜索（纯函数，零依赖，手写不用 fuse.js）
 *
 * 只做「大小写不敏感的包含匹配 + 权重排序」：
 *   正文命中 > 标签命中 > 备注命中
 * 同一档内先按命中位置靠前、再按传入顺序，保证结果稳定可预期。
 */

/**
 * 与 C1 的 Todo 同构的本地类型。
 * 并行开发期不 import todoStore，合并后可直接换成 todoStore 的导出（结构一致）。
 */
export type Todo = {
  id: string;
  text: string;
  done: boolean;
  order: number;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  dueAt?: number;
  priority: 0 | 1 | 2 | 3;
  tags: string[];
  notes?: string;
  pinned?: boolean;
  /* memo 也走同一套索引：正文 > 标签 > 备注，权重一致 */
  type?: "task" | "memo";
};

export type SearchRange = { start: number; end: number };

export type SearchHit = {
  item: Todo;
  /** 命中的高亮区间，坐标相对 item.text；命中只落在 tags/notes 时为空数组 */
  ranges: SearchRange[];
};

export type TextSegment = { text: string; match: boolean };

const WEIGHT_TEXT = 3;
const WEIGHT_TAG = 2;
const WEIGHT_NOTES = 1;

/** 找出 needle 在 text 里的全部（不重叠）出现位置 */
function findRanges(text: string, needle: string): SearchRange[] {
  if (!text || !needle) return [];

  const haystack = text.toLowerCase();
  const ranges: SearchRange[] = [];
  let from = 0;

  while (from <= haystack.length - needle.length) {
    const index = haystack.indexOf(needle, from);
    if (index === -1) break;
    ranges.push({ start: index, end: index + needle.length });
    from = index + needle.length;
  }

  return ranges;
}

function matchScore(item: Todo, needle: string): { score: number; ranges: SearchRange[] } {
  const text = typeof item.text === "string" ? item.text : "";
  const ranges = findRanges(text, needle);
  if (ranges.length > 0) return { score: WEIGHT_TEXT, ranges };

  const tags = Array.isArray(item.tags) ? item.tags : [];
  if (tags.some((tag) => typeof tag === "string" && tag.toLowerCase().includes(needle))) {
    return { score: WEIGHT_TAG, ranges: [] };
  }

  const notes = typeof item.notes === "string" ? item.notes : "";
  if (notes.toLowerCase().includes(needle)) return { score: WEIGHT_NOTES, ranges: [] };

  return { score: 0, ranges: [] };
}

/**
 * 搜索任务。
 * @param items 任务列表（不改动入参）
 * @param query 关键词；空白或空串返回 []
 */
export function searchItems(items: Todo[], query: string): SearchHit[] {
  const trimmed = typeof query === "string" ? query.trim() : "";
  if (!trimmed || !Array.isArray(items)) return [];

  const needle = trimmed.toLowerCase();
  const scored: { item: Todo; ranges: SearchRange[]; score: number; at: number; index: number }[] = [];

  items.forEach((item, index) => {
    if (!item || typeof item !== "object") return;
    const { score, ranges } = matchScore(item, needle);
    if (score === 0) return;
    scored.push({
      item,
      ranges,
      score,
      at: ranges.length > 0 ? ranges[0].start : Number.POSITIVE_INFINITY,
      index,
    });
  });

  scored.sort((a, b) => b.score - a.score || a.at - b.at || a.index - b.index);

  return scored.map(({ item, ranges }) => ({ item, ranges }));
}

/**
 * 把正文按高亮区间切段，给 <mark> 渲染用。
 * 非法 / 越界 / 重叠的区间会被安全丢掉，不抛错。
 */
export function splitByRanges(text: string, ranges: SearchRange[]): TextSegment[] {
  const source = typeof text === "string" ? text : "";
  if (!source) return [];

  const valid = (Array.isArray(ranges) ? ranges : [])
    .filter(
      (range) =>
        range &&
        Number.isFinite(range.start) &&
        Number.isFinite(range.end) &&
        range.start >= 0 &&
        range.end <= source.length &&
        range.end > range.start,
    )
    .sort((a, b) => a.start - b.start);

  const segments: TextSegment[] = [];
  let cursor = 0;

  for (const range of valid) {
    if (range.start < cursor) continue; // 重叠段直接跳过
    if (range.start > cursor) segments.push({ text: source.slice(cursor, range.start), match: false });
    segments.push({ text: source.slice(range.start, range.end), match: true });
    cursor = range.end;
  }

  if (cursor < source.length) segments.push({ text: source.slice(cursor), match: false });

  return segments.length > 0 ? segments : [{ text: source, match: false }];
}
