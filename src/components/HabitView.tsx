import { useState } from "react";
import {
  createHabit,
  habitOverview,
  habitStreak,
  isCheckedOn,
  removeHabit,
  renameHabit,
  toggleCheckin,
  weekCheckedCount,
} from "../lib/habit";
import type { Habit } from "../lib/habit";
import "./HabitView.css";

/**
 * 习惯打卡视图（可选池）：极简「每日一次」。
 * 概览卡（总数 / 最佳连续 / 今日已打卡）+ 习惯列表（打卡按钮 + 连续天数 + 本周次数 + 删除）。
 */
export default function HabitView(props: {
  habits: Habit[];
  now: number;
  onChange: (habits: Habit[]) => void;
  announce: (message: string) => void;
}) {
  const { habits, now, onChange, announce } = props;
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  const overview = habitOverview(habits, now);

  function addHabit() {
    const trimmed = name.trim();
    if (trimmed.length === 0) return;
    onChange([...habits, createHabit(trimmed, now)]);
    setName("");
    announce(`已添加习惯「${trimmed}」`);
  }

  function toggle(habit: Habit) {
    const day = now;
    const next = toggleCheckin(habit, day);
    onChange(habits.map((h) => (h.id === habit.id ? next : h)));
    announce(isCheckedOn(next, day) ? `已打卡「${habit.name}」` : `已取消「${habit.name}」打卡`);
  }

  function remove(id: string, habitName: string) {
    onChange(removeHabit(habits, id));
    announce(`已删除习惯「${habitName}」`);
  }

  function startEdit(habit: Habit) {
    setEditingId(habit.id);
    setEditText(habit.name);
  }

  function commitEdit(habit: Habit) {
    const next = renameHabit(habit, editText);
    onChange(habits.map((h) => (h.id === habit.id ? next : h)));
    setEditingId(null);
  }

  return (
    <section className="habit-view" aria-label="习惯打卡">
      {/* 概览卡 */}
      <div className="habit-overview">
        <div className="habit-overview-item">
          <span className="habit-overview-value">{overview.total}</span>
          <span className="habit-overview-label">习惯</span>
        </div>
        <div className="habit-overview-item">
          <span className="habit-overview-value">{overview.bestStreak}</span>
          <span className="habit-overview-label">最佳连续</span>
        </div>
        <div className="habit-overview-item">
          <span className="habit-overview-value">{overview.checkedToday}</span>
          <span className="habit-overview-label">今日已打卡</span>
        </div>
      </div>

      {/* 新建 */}
      <div className="habit-add">
        <input
          className="habit-add-input"
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.nativeEvent.isComposing) addHabit();
          }}
          placeholder="添加一个习惯，如「晨跑」"
          maxLength={40}
          aria-label="新习惯名称"
        />
        <button type="button" className="btn-primary sm" onClick={addHabit} disabled={name.trim().length === 0}>
          添加
        </button>
      </div>

      {/* 习惯列表 */}
      {habits.length === 0 ? (
        <p className="habit-empty">还没有习惯，添加一个，从今天开始坚持。</p>
      ) : (
        <ul className="habit-list">
          {habits.map((habit) => {
            const checked = isCheckedOn(habit, now);
            return (
              <li className={`habit-row${checked ? " is-checked" : ""}`} key={habit.id}>
                <button
                  type="button"
                  className={`habit-check${checked ? " on" : ""}`}
                  onClick={() => toggle(habit)}
                  aria-pressed={checked}
                  aria-label={checked ? `取消「${habit.name}」打卡` : `打卡「${habit.name}」`}
                >
                  {checked ? "✓" : ""}
                </button>
                <div className="habit-meta">
                  {editingId === habit.id ? (
                    <input
                      className="habit-edit-input"
                      value={editText}
                      onChange={(event) => setEditText(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.nativeEvent.isComposing) commitEdit(habit);
                        if (event.key === "Escape") setEditingId(null);
                      }}
                      onBlur={() => commitEdit(habit)}
                      autoFocus
                      aria-label="编辑习惯名称"
                    />
                  ) : (
                    <button
                      type="button"
                      className="habit-name"
                      onClick={() => startEdit(habit)}
                      title="点击重命名"
                    >
                      {habit.name}
                    </button>
                  )}
                  <span className="habit-stats">
                    连续 {habitStreak(habit, now)} 天 · 本周 {weekCheckedCount(habit, now)} 次
                  </span>
                </div>
                <button
                  type="button"
                  className="habit-remove"
                  onClick={() => remove(habit.id, habit.name)}
                  aria-label={`删除习惯「${habit.name}」`}
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
