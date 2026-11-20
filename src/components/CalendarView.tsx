import { useMemo, useState } from "react";
import {
  CALENDAR_WEEKDAY_LABELS,
  buildMonthGrid,
  buildWeekView,
  formatMonthTitle,
} from "../lib/calendar";
import { formatTime } from "../lib/dates";
import type { Todo } from "../lib/todoStore";
import "./CalendarView.css";

type Mode = "week" | "month";

/**
 * 日历视图（主题 01）：周视图（7 列 + 今天高亮 + now line）与月视图（6×7 网格 + 每日角标）。
 * 纯展示 + 轻量交互（勾选完成）；颜色全走主题 CSS 变量（--color-*）。
 */
export default function CalendarView(props: {
  todos: Todo[];
  now: number;
  onToggle: (id: string) => void;
  onOpenTodo: (id: string) => void;
}) {
  const { todos, now, onToggle, onOpenTodo } = props;
  const [mode, setMode] = useState<Mode>("week");

  const week = useMemo(() => buildWeekView(todos, now), [todos, now]);
  const month = useMemo(() => buildMonthGrid(todos, now), [todos, now]);

  const nowMinutes = useMemo(() => {
    const d = new Date(now);
    return d.getHours() * 60 + d.getMinutes();
  }, [now]);

  function chipLabel(todo: Todo): string {
    const time = todo.dueAt !== undefined && todo.dueAt !== 0 ? `${formatTime(todo.dueAt)} ` : "";
    return `${time}${todo.text}`;
  }

  function renderChip(todo: Todo) {
    return (
      <button
        key={todo.id}
        type="button"
        className={`cal-chip${todo.done ? " is-done" : ""}`}
        onClick={() => onToggle(todo.id)}
        onDoubleClick={() => onOpenTodo(todo.id)}
        title={`${chipLabel(todo)}${todo.done ? "（已完成）" : ""}`}
      >
        <span className="cal-chip-check" aria-hidden="true" />
        <span className="cal-chip-text">{todo.text}</span>
        {todo.dueAt !== undefined && todo.dueAt !== 0 && (
          <span className="cal-chip-time">{formatTime(todo.dueAt)}</span>
        )}
      </button>
    );
  }

  return (
    <section className="cal-view" aria-label="日历">
      {/* 顶部：切换 + 概览 */}
      <div className="cal-head">
        <div className="cal-seg" role="tablist" aria-label="日历视图切换">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "week"}
            className={`cal-seg-btn${mode === "week" ? " is-active" : ""}`}
            onClick={() => setMode("week")}
          >
            周
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "month"}
            className={`cal-seg-btn${mode === "month" ? " is-active" : ""}`}
            onClick={() => setMode("month")}
          >
            月
          </button>
        </div>

        <div className="cal-head-summary" aria-live="polite">
          {mode === "week" ? (
            <span>
              本周完成 <strong>{week.weekCompleted}</strong> 项
              {week.weekOverdue > 0 && (
                <>
                  {" "}
                  · 逾期 <strong>{week.weekOverdue}</strong> 项
                </>
              )}
            </span>
          ) : (
            <span>
              {formatMonthTitle(month.monthStart)} · 完成{" "}
              <strong>{month.monthCompleted}</strong> 项 · 有记录{" "}
              <strong>{month.activeDays}</strong> 天
            </span>
          )}
        </div>
      </div>

      {mode === "week" ? (
        <div className="cal-week" role="grid" aria-label="周视图">
          <div className="cal-week-row cal-week-header" role="row">
            {CALENDAR_WEEKDAY_LABELS.map((label, i) => {
              const cell = week.cells[i];
              const dayNum = new Date(cell.day).getDate();
              return (
                <div
                  key={label}
                  role="columnheader"
                  className={`cal-week-head${cell.isToday ? " is-today" : ""}`}
                >
                  <span className="cal-week-head-label">{label}</span>
                  <span className="cal-week-head-day">{dayNum}</span>
                </div>
              );
            })}
          </div>

          <div className="cal-week-row cal-week-body" role="row">
            {week.cells.map((cell) => (
              <div
                key={cell.day}
                role="gridcell"
                className={`cal-week-cell${cell.isToday ? " is-today" : ""}`}
              >
                {cell.isToday && (
                  <span
                    className="cal-now-line"
                    style={{ top: `${Math.min(100, (nowMinutes / (24 * 60)) * 100)}%` }}
                    aria-hidden="true"
                  />
                )}
                <div className="cal-week-tasks">
                  {cell.todos.length === 0 ? (
                    <span className="cal-week-empty" aria-hidden="true">
                      —
                    </span>
                  ) : (
                    cell.todos.map(renderChip)
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="cal-month" role="grid" aria-label="月视图">
          <div className="cal-month-row cal-month-header" role="row">
            {CALENDAR_WEEKDAY_LABELS.map((label) => (
              <div key={label} role="columnheader" className="cal-month-head">
                {label}
              </div>
            ))}
          </div>
          {Array.from({ length: 6 }, (_, row) => (
            <div className="cal-month-row" role="row" key={row}>
              {month.cells.slice(row * 7, row * 7 + 7).map((cell) => {
                const dayNum = new Date(cell.day).getDate();
                return (
                  <div
                    key={cell.day}
                    role="gridcell"
                    className={`cal-month-cell${cell.outside ? " is-outside" : ""}${cell.isToday ? " is-today" : ""}`}
                  >
                    <div className="cal-month-cell-head">
                      <span className="cal-month-day">{dayNum}</span>
                      {cell.openCount > 0 && (
                        <span className="cal-month-badge">{cell.openCount}</span>
                      )}
                    </div>
                    <div className="cal-month-tasks">
                      {cell.todos.slice(0, 3).map(renderChip)}
                      {cell.todos.length > 3 && (
                        <span className="cal-month-more">+{cell.todos.length - 3}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
