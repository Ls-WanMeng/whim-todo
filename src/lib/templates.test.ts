import { describe, expect, it } from "vitest";
import { TASK_TEMPLATES, buildTemplateTask } from "./templates";

function at(month: number, day: number, hour = 0, minute = 0): number {
  return new Date(2026, month - 1, day, hour, minute).getTime();
}

const THU_10 = at(11, 19, 10, 0);

function template(id: string) {
  const found = TASK_TEMPLATES.find((item) => item.id === id);
  if (!found) throw new Error(`模板 ${id} 不存在`);
  return found;
}

describe("TASK_TEMPLATES", () => {
  it("id 唯一，且每条都带正文、标签、重复规则与说明", () => {
    const ids = TASK_TEMPLATES.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const item of TASK_TEMPLATES) {
      expect(item.text.trim()).not.toBe("");
      expect(item.hint.trim()).not.toBe("");
      expect(item.tags.length).toBeGreaterThan(0);
      expect(["daily", "weekdays", "weekly"]).toContain(item.repeat.kind);
    }
  });

  it("覆盖三种重复规则：每天、工作日、每周", () => {
    const kinds = TASK_TEMPLATES.map((item) => item.repeat.kind);
    expect(kinds).toContain("daily");
    expect(kinds).toContain("weekdays");
    expect(kinds).toContain("weekly");
  });
});

describe("buildTemplateTask", () => {
  it("每周复盘：周四 10 点套用，首次落在周日 20 点", () => {
    const draft = buildTemplateTask(template("weekly-review"), THU_10);

    expect(draft.dueAt).toBe(at(11, 22, 20, 0));
    expect(draft.repeat).toEqual({ kind: "weekly", weekday: 6 });
    expect(draft.tags).toEqual(["复盘"]);
    expect(draft.priority).toBe(2);
    expect(draft.notes).toBeTruthy();
    expect(draft.text).toContain("回顾这周");
  });

  it("每日收尾：周四 22 点套用，首次落在明天 21:30", () => {
    const draft = buildTemplateTask(template("daily-tidy"), at(11, 19, 22, 0));
    expect(draft.dueAt).toBe(at(11, 20, 21, 30));
    expect(draft.repeat).toEqual({ kind: "daily" });
  });

  it("工作日晨报：周五中午套用，跳到下周一 09:30", () => {
    const draft = buildTemplateTask(template("workday-standup"), at(11, 20, 12, 0));
    expect(draft.dueAt).toBe(at(11, 23, 9, 30));
    expect(draft.repeat).toEqual({ kind: "weekdays" });
  });

  it("每周规划：周三套用，首次落在下周一 09:00", () => {
    const draft = buildTemplateTask(template("weekly-plan"), at(11, 18, 15, 0));
    expect(draft.dueAt).toBe(at(11, 23, 9, 0));
  });

  it("返回的标签是副本，改动不会污染模板定义", () => {
    const draft = buildTemplateTask(template("weekly-review"), THU_10);
    draft.tags.push("临时");
    expect(template("weekly-review").tags).toEqual(["复盘"]);
  });

  it("同一个模板在同一时刻套用两次，结果一致（纯函数）", () => {
    const a = buildTemplateTask(template("weekly-plan"), THU_10);
    const b = buildTemplateTask(template("weekly-plan"), THU_10);
    expect(a).toEqual(b);
  });
});
