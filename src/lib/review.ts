/**
 * C5-5 · 每日回顾（纯函数，零依赖）
 *
 * 规则：
 *   1. 只回顾「备忘」，且只抽创建满 7 天以上的旧记录；
 *   2. 默认抽 3 条；
 *   3. 同一天内种子固定（刷新页面不会换），次日种子自动变化；
 *   4. 「换一批」用 reviewSeedForBatch(seed, n) 派生新种子，仍由种子决定结果，可测可复现。
 */

import { addDays, startOfDay } from "./dates";
import type { Todo } from "./todoStore";

export const DAILY_REVIEW_SIZE = 3;
/** 至少创建满这么多天才算「旧记录」 */
export const REVIEW_MIN_AGE_DAYS = 7;

/** 同一天固定、次日更换的种子：YYYYMMDD */
export function dailyReviewSeed(now = Date.now()): number {
  const date = new Date(startOfDay(now));
  return date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
}

/** 换一批的种子：batch 0 就是当天种子，之后每批换一个固定偏移 */
export function reviewSeedForBatch(seed: number, batch: number): number {
  const safeBatch = Number.isFinite(batch) && batch > 0 ? Math.floor(batch) : 0;
  return seed + safeBatch * 7919;
}

/** 可回顾的旧备忘（创建时间早于「今天 - 7 天」的 0 点） */
export function reviewableMemos(items: Todo[], now = Date.now()): Todo[] {
  const cutoff = addDays(startOfDay(now), -REVIEW_MIN_AGE_DAYS);
  return (Array.isArray(items) ? items : []).filter(
    (item) => item && item.type === "memo" && Number.isFinite(item.createdAt) && item.createdAt < cutoff,
  );
}

/** 32 位确定性随机数发生器（同一 seed 必然得到同一序列） */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 抽今天的旧备忘。
 * @param items 全部条目（任务与 7 天内的新备忘都会被过滤掉）
 * @param now 参照时刻（测试请传固定值）
 * @param seed 复盘种子，宿主用 dailyReviewSeed() / reviewSeedForBatch() 提供
 */
export function dailyReview(items: Todo[], now: number, seed: number): Todo[] {
  const pool = reviewableMemos(items, now)
    .slice()
    .sort((a, b) => a.createdAt - b.createdAt || a.order - b.order);
  if (pool.length === 0) return [];

  const rand = mulberry32(Number.isFinite(seed) ? seed : 0);
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = pool[i];
    pool[i] = pool[j];
    pool[j] = tmp;
  }

  return pool.slice(0, Math.min(DAILY_REVIEW_SIZE, pool.length));
}