/**
 * C6 · 内置任务模板（纯函数，零依赖）
 *
 * 命令面板「套用模板」用：给出正文 / 标签 / 优先级 / 首次截止时间 / 重复规则的草稿，
 * 由宿主交给 createTodo 落库。模板只内置几条高频的，不做用户自定义。
 */
import { applyTimeOfDay, startOfDay } from "./dates";
import { firstRepeatDueAt } from "./repeat";
import type { RepeatRule } from "./repeat";
import type { Priority } from "./todoStore";

export type TaskTemplate = {
  id: string;
  label: string;
  /** 面板里的第二行说明 */
  hint: string;
  text: string;
  tags: string[];
  priority: Priority;
  repeat: RepeatRule;
  /** 首次到期的钟点 HH:MM；缺省按 00:00 */
  time?: string;
  notes?: string;
};

export type TemplateDraft = {
  text: string;
  tags: string[];
  priority: Priority;
  notes?: string;
  repeat: RepeatRule;
  /** 从「现在」起最近一次的到期时刻 */
  dueAt: number;
};

export const TASK_TEMPLATES: TaskTemplate[] = [
  {
    id: "weekly-review",
    label: "每周复盘",
    hint: "每周日 20:00 · #复盘",
    text: "回顾这周：做成了什么、卡在哪、下周先做哪件",
    tags: ["复盘"],
    priority: 2,
    repeat: { kind: "weekly", weekday: 6 },
    time: "20:00",
    notes: "三句话就够：进展、阻塞、下一步。",
  },
  {
    id: "weekly-plan",
    label: "每周规划",
    hint: "每周一 09:00 · #规划",
    text: "给下周排 3 件必须完成的事",
    tags: ["规划"],
    priority: 2,
    repeat: { kind: "weekly", weekday: 0 },
    time: "09:00",
  },
  {
    id: "workday-standup",
    label: "工作日晨报",
    hint: "工作日 09:30 · #工作",
    text: "过一遍今天的日程，确认最要紧的一件",
    tags: ["工作"],
    priority: 1,
    repeat: { kind: "weekdays" },
    time: "09:30",
  },
  {
    id: "daily-tidy",
    label: "每日收尾",
    hint: "每天 21:30 · #整理",
    text: "清空收件箱：没日期的任务排个期，做不了的删掉",
    tags: ["整理"],
    priority: 1,
    repeat: { kind: "daily" },
    time: "21:30",
  },
];

/** 把模板摊成可直接落库的草稿：截止时间取「从现在起最近一次命中」 */
export function buildTemplateTask(template: TaskTemplate, now = Date.now()): TemplateDraft {
  const prototype =
    template.time === undefined ? undefined : applyTimeOfDay(startOfDay(now), template.time);

  return {
    text: template.text,
    tags: [...template.tags],
    priority: template.priority,
    notes: template.notes,
    repeat: template.repeat,
    dueAt: firstRepeatDueAt(template.repeat, now, prototype),
  };
}
