/**
 * 可选池 · 分享清单快照图（纯浏览器 Canvas，零依赖）
 *
 * 把当前清单画成一张可分享的 PNG：标题 + 日期 + 完成/总数 + 前 N 条待办。
 * 全部用原生 Canvas 2D 绘制，不依赖任何第三方包（resvg 是 Node-only，不能进浏览器 bundle）。
 *
 * 数据准备（统计 / 截断）是纯函数可测；实际绘制走 Canvas（浏览器 API）。
 */

import type { Todo } from "./todoStore";

export type SnapshotTheme = {
  background: string;
  card: string;
  foreground: string;
  subtle: string;
  primary: string;
  onPrimary: string;
};

export type SnapshotOptions = {
  title?: string;
  now?: number;
  /** 最多列出的条目数 */
  maxItems?: number;
  /** 是否只列未完成 */
  pendingOnly?: boolean;
};

export const DEFAULT_MAX_ITEMS = 10;
const WIDTH = 600;
const PADDING = 28;
const LINE_HEIGHT = 34;
const HEADER_HEIGHT = 100;

function dateLabel(now: number): string {
  const date = new Date(now);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
  return `${month}月${day}日 · 周${weekdays[date.getDay()]}`;
}

/** 单条待办截断（按字符数，中文友好） */
function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

/** 准备快照所需的数据（纯函数，可测） */
export function prepareSnapshot(items: Todo[], options: SnapshotOptions = {}) {
  const now = options.now ?? Date.now();
  const title = options.title ?? "我的待办清单";
  const maxItems = options.maxItems ?? DEFAULT_MAX_ITEMS;

  const doneCount = items.filter((item) => item.done).length;
  const pending = options.pendingOnly ? items.filter((item) => !item.done) : items;
  const listed = pending.slice(0, maxItems);
  const omitted = pending.length - listed.length;

  return {
    now,
    title,
    doneCount,
    total: items.length,
    listed: listed.map((item) => ({ text: truncate(item.text, 30), done: item.done })),
    omitted,
  };
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** 用 Canvas 2D 把快照画到画布上（浏览器 API） */
export function drawSnapshot(
  ctx: CanvasRenderingContext2D,
  items: Todo[],
  theme: SnapshotTheme,
  options: SnapshotOptions = {},
): { width: number; height: number } {
  const snapshot = prepareSnapshot(items, options);
  const height = HEADER_HEIGHT + snapshot.listed.length * LINE_HEIGHT + PADDING;

  // 背景 + 卡片
  roundRect(ctx, 0, 0, WIDTH, height, 20);
  ctx.fillStyle = theme.background;
  ctx.fill();
  roundRect(ctx, 14, 14, WIDTH - 28, height - 28, 16);
  ctx.fillStyle = theme.card;
  ctx.fill();

  // 标题 + 日期统计
  ctx.fillStyle = theme.foreground;
  ctx.font = "700 22px system-ui, sans-serif";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(snapshot.title, PADDING, 48);

  ctx.fillStyle = theme.subtle;
  ctx.font = "13px system-ui, sans-serif";
  ctx.fillText(`${dateLabel(snapshot.now)} · 完成 ${snapshot.doneCount} / 共 ${snapshot.total}`, PADDING, 74);

  ctx.fillStyle = theme.subtle;
  ctx.globalAlpha = 0.3;
  ctx.fillRect(PADDING, 88, WIDTH - PADDING * 2, 1);
  ctx.globalAlpha = 1;

  // 条目
  snapshot.listed.forEach((row, index) => {
    const y = HEADER_HEIGHT + PADDING + index * LINE_HEIGHT;
    ctx.fillStyle = theme.subtle;
    ctx.font = "16px system-ui, sans-serif";
    ctx.fillText(row.done ? "✓" : "○", PADDING + 6, y);
    ctx.fillStyle = row.done ? theme.subtle : theme.foreground;
    ctx.fillText(row.text, PADDING + 32, y);
    if (row.done) {
      const width = ctx.measureText(row.text).width;
      ctx.fillRect(PADDING + 32, y - 4, width, 1);
    }
  });

  if (snapshot.omitted > 0) {
    ctx.fillStyle = theme.subtle;
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(`还有 ${snapshot.omitted} 条未列出`, WIDTH - PADDING, height - 16);
    ctx.textAlign = "left";
  }

  return { width: WIDTH, height };
}

/** 触发 PNG 下载；返回 false 表示环境不支持（如 SSR/测试） */
export async function downloadSnapshotPng(
  items: Todo[],
  theme: SnapshotTheme,
  options: SnapshotOptions = {},
): Promise<boolean> {
  if (typeof document === "undefined") return false;

  const canvas = document.createElement("canvas");
  const scale = 2; // 2x 清晰度
  const snapshot = prepareSnapshot(items, options);
  const height = HEADER_HEIGHT + snapshot.listed.length * LINE_HEIGHT + PADDING;

  canvas.width = WIDTH * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;
  ctx.scale(scale, scale);

  drawSnapshot(ctx, items, theme, options);

  const url = canvas.toDataURL("image/png");
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `whim-todo-snapshot-${new Date().toISOString().slice(0, 10)}.png`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  return true;
}
