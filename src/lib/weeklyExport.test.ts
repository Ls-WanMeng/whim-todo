import { describe, expect, it, vi } from "vitest";

import { createTodo, type Todo } from "./todoStore";
import { buildWeeklyReportFile, weeklyReportFileName } from "./weeklyExport";

const NOW = new Date(2026, 10, 19, 15, 30).getTime(); // 2026-11-19 周四

function doneItem(text: string, completedAt: number): Todo {
  const base = createTodo(text, NOW);
  return { ...base, done: true, completedAt };
}

describe("weeklyReportFileName", () => {
  it("以周报覆盖周的周一命名", () => {
    // NOW 周四 → 本周一 2026-11-16
    const monday = new Date(2026, 10, 16).getTime();
    expect(weeklyReportFileName(monday)).toBe("whim-todo-weekly-2026-11-16.md");
  });
});

describe("buildWeeklyReportFile", () => {
  it("生成文件名与 Markdown 内容", () => {
    const monday = new Date(2026, 10, 16).getTime();
    const items = [doneItem("写周报", monday + 3600 * 1000)];
    const file = buildWeeklyReportFile(items, NOW);
    expect(file.fileName).toBe("whim-todo-weekly-2026-11-16.md");
    expect(file.content).toContain("# Whim Todo 周报");
    expect(file.content).toContain("完成：1 项");
  });

  it("空数据也能生成报告文件", () => {
    const file = buildWeeklyReportFile([], NOW);
    expect(file.content).toContain("完成：0 项");
  });
});

describe("downloadWeeklyReport 环境守卫", () => {
  it("非浏览器环境返回 false 而不抛错", async () => {
    const mod = await import("./weeklyExport");
    // vitest node 环境下 document 未定义（当前测试为纯 node，无 jsdom）
    const result = mod.downloadWeeklyReport([], NOW);
    expect(result).toBe(false);
  });

  it("浏览器环境下触发一次点击并清理（模拟验证）", async () => {
    // 手工构造最小 DOM stub，验证调用序列
    const clicks: unknown[] = [];
    const created: string[] = [];
    const anchorStub = {
      href: "",
      download: "",
      click: () => clicks.push(1),
      remove: () => {},
    };
    vi.stubGlobal("document", {
      createElement: () => anchorStub,
      body: { appendChild: () => {}, },
    });
    vi.stubGlobal("Blob", class {
      constructor(_parts: string[], opts: { type: string }) {
        created.push(opts.type);
      }
    });
    vi.stubGlobal("URL", { createObjectURL: () => "blob:fake" });

    const mod = await import("./weeklyExport");
    const items = [doneItem("x", NOW)];
    expect(mod.downloadWeeklyReport(items, NOW)).toBe(true);
    expect(clicks).toHaveLength(1);
    expect(created).toContain("text/markdown;charset=utf-8");
    expect(anchorStub.download).toMatch(/^whim-todo-weekly-\d{4}-\d{2}-\d{2}\.md$/);

    vi.unstubAllGlobals();
  });
});
