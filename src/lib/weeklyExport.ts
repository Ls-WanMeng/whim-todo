/*
 * 周报导出：把 weeklyReport 的 Markdown 以 Blob 下载，复用任务导出的文件命名风格。
 * 纯浏览器 API，零依赖。
 */

import { weeklyReport } from "./stats";
import type { Todo } from "./todoStore";


/** whim-todo-weekly-YYYY-MM-DD.md（日期为周报覆盖周的周一） */
export function weeklyReportFileName(weekStart: number, _now = new Date()): string {
  const start = new Date(weekStart);
  const month = String(start.getMonth() + 1).padStart(2, "0");
  const day = String(start.getDate()).padStart(2, "0");
  return `whim-todo-weekly-${start.getFullYear()}-${month}-${day}.md`;
}

export function buildWeeklyReportFile(items: Todo[], now: number): { fileName: string; content: string } {
  const report = weeklyReport(items, now);
  return {
    fileName: weeklyReportFileName(report.weekStart),
    content: report.markdown,
  };
}

/** 触发浏览器下载；返回 false 表示环境不支持（如 SSR/测试环境） */
export function downloadWeeklyReport(items: Todo[], now: number): boolean {  if (typeof document === "undefined" || typeof Blob === "undefined" || typeof URL === "undefined") {
    return false;
  }

  const { fileName, content } = buildWeeklyReportFile(items, now);
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
