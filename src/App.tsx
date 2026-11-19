import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { AnimatePresence, Reorder, motion, useDragControls } from "motion/react";
import confetti from "canvas-confetti";
import AnimatedContent from "./components/reactbits/AnimatedContent";
import BlurText from "./components/reactbits/BlurText";
import CountUp from "./components/reactbits/CountUp";
import SpotlightCard from "./components/reactbits/SpotlightCard";
import ShinyText from "./components/reactbits/ShinyText";
import whimTodoLogo from "./assets/whim-todo-logo.svg";
import CommandPalette from "./components/CommandPalette";
import type { PaletteCommand } from "./components/CommandPalette";
import GlassSelect from "./components/GlassSelect";
import QuickAddChips from "./components/QuickAddChips";
import SettingsPanel from "./components/SettingsPanel";
import ThemeScene from "./components/ThemeScene";
import { useMotionPreference } from "./hooks/useMotionPreference";
import {
  MAX_TEXT_LENGTH,
  STORAGE_KEY,
  clearDone,
  createTodo,
  exportFileName,
  moveTodoAmong,
  parseImport,
  readState,
  removeTodo,
  restoreTodos,
  serializeExport,
  toggleTodo,
  updateTodo,
  updateTodoText,
  writeState,
  createMemo,
  isMemo,
  maxTextLength,
  memoTimeline,
} from "./lib/todoStore";
import type { Priority, RemovedTodo, Todo, TodoPatch } from "./lib/todoStore";
import {
  DUE_BUCKET_LABELS,
  DUE_BUCKET_ORDER,
  applyTimeOfDay,
  formatDateShort,
  formatDue,
  formatTime,
  fromDateInputValue,
  getDueBucket,
  isOverdue,
  startOfDay,
  toDateInputValue,
  toTimeInputValue,
} from "./lib/dates";
import type { DueBucket } from "./lib/dates";
import {
  getTheme,
  readThemePair,
  readThemePref,
  resolveThemeId,
  toggleTheme,
  writeThemePair,
  writeThemePref,
} from "./lib/themes";
import type { ThemeId, ThemePair, ThemePref } from "./lib/themes";
import { renderMarkdown } from "./lib/markdown";
import { parseMemoInput, parseQuickAdd } from "./lib/quickAdd";
import { DAILY_REVIEW_SIZE, dailyReview, dailyReviewSeed, reviewSeedForBatch } from "./lib/review";
import "./App.css";

type View = "inbox" | "today" | "planned" | "all" | "memo";
type SortMode = "manual" | "due" | "priority" | "created";

function burst(colors: string[], big = false) {
  confetti({
    particleCount: big ? 140 : 28,
    spread: big ? 100 : 55,
    startVelocity: big ? 38 : 24,
    origin: { y: 0.7 },
    colors,
    disableForReducedMotion: true,
  });
}

function systemPrefersDark(): boolean {
  return !window.matchMedia("(prefers-color-scheme: light)").matches;
}

const VIEWS: { key: View; label: string }[] = [
  { key: "inbox", label: "收件箱" },
  { key: "today", label: "今天" },
  { key: "planned", label: "计划" },
  { key: "all", label: "全部" },
  { key: "memo", label: "备忘" },
];

const SORTS: { key: SortMode; label: string }[] = [
  { key: "manual", label: "手动" },
  { key: "due", label: "截止时间" },
  { key: "priority", label: "优先级" },
  { key: "created", label: "创建时间" },
];

type EntryMode = "task" | "memo";

const PRIORITY_LABELS: Record<Priority, string> = { 0: "无", 1: "低", 2: "中", 3: "高" };
const PRIORITY_OPTIONS: Priority[] = [0, 1, 2, 3];

function PlusIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v6M14 11v6" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 20h4l10-10a2.8 2.8 0 0 0-4-4L4 16v4Z" />
      <path d="m13.5 6.5 4 4" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

function GripIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="9" cy="6" r="1.6" /><circle cx="15" cy="6" r="1.6" />
      <circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="12" r="1.6" />
      <circle cx="9" cy="18" r="1.6" /><circle cx="15" cy="18" r="1.6" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.2-3.2" />
    </svg>
  );
}

function ChevronUpIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 14l6-6 6 6" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 10l6 6 6-6" />
    </svg>
  );
}

function ClipboardIcon() {
  return (
    <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4V3h6v1M9 10h6M9 14h4" />
    </svg>
  );
}

const RING_R = 24;
const RING_C = 2 * Math.PI * RING_R;

function TodoItem(props: {
  todo: Todo;
  index: number;
  total: number;
  canDrag: boolean;
  canMove: boolean;
  reduced: boolean;
  highlighted: boolean;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
  onEdit: (id: string, text: string) => void;
  onPatch: (id: string, patch: TodoPatch) => void;
  onMove: (id: string, delta: number) => void;
}) {
  const {
    todo,
    index,
    total,
    canDrag,
    canMove,
    reduced,
    highlighted,
    onToggle,
    onRemove,
    onEdit,
    onPatch,
    onMove,
  } = props;
  const controls = useDragControls();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(todo.text);
  const [detailOpen, setDetailOpen] = useState(false);
  const [tagDraft, setTagDraft] = useState(todo.tags.join(" "));
  const [notesDraft, setNotesDraft] = useState(todo.notes ?? "");
  const editRef = useRef<HTMLInputElement>(null);
  const escaping = useRef(false);
  const committing = useRef(false);
  const detailId = useId();

  useEffect(() => {
    if (!editing) return;
    const input = editRef.current;
    input?.focus();
    input?.select();
  }, [editing]);

  function startEdit() {
    setDraft(todo.text);
    escaping.current = false;
    committing.current = false;
    setEditing(true);
  }

  function commitEdit() {
    if (escaping.current) {
      escaping.current = false;
      return;
    }
    if (committing.current) return;
    committing.current = true;
    const nextText = draft.trim();
    setEditing(false);
    if (!nextText || nextText === todo.text) {
      setDraft(todo.text);
      return;
    }
    onEdit(todo.id, nextText);
  }

  function cancelEdit() {
    escaping.current = true;
    setDraft(todo.text);
    setEditing(false);
  }

  function toggleDetail() {
    setTagDraft(todo.tags.join(" "));
    setNotesDraft(todo.notes ?? "");
    setDetailOpen((open) => !open);
  }

  function setDueDate(value: string) {
    if (!value) {
      onPatch(todo.id, { dueAt: null });
      return;
    }
    const day = fromDateInputValue(value);
    if (day === undefined) return;
    const time = toTimeInputValue(todo.dueAt);
    onPatch(todo.id, { dueAt: time ? applyTimeOfDay(day, time) : day });
  }

  function setDueTime(value: string) {
    const base = todo.dueAt ?? startOfDay(Date.now());
    onPatch(todo.id, { dueAt: applyTimeOfDay(base, value) });
  }

  function commitTags() {
    onPatch(todo.id, { tags: tagDraft.split(/[\s,，]+/).filter(Boolean) });
  }

  function commitNotes() {
    onPatch(todo.id, { notes: notesDraft.trim() ? notesDraft : null });
  }

  const overdue = todo.dueAt !== undefined && !todo.done && isOverdue(todo.dueAt);
  const hasMeta = todo.dueAt !== undefined || todo.priority > 0 || todo.tags.length > 0;

  const content = (
    <>
      <div className="todo-row">
        {canDrag && (
          <span className="drag" title="拖动排序" aria-hidden="true" onPointerDown={(e) => controls.start(e)}>
            <GripIcon />
          </span>
        )}
        <input
          type="checkbox"
          className="todo-check"
          checked={todo.done}
          onChange={() => onToggle(todo.id)}
          aria-label={`标记「${todo.text}」为${todo.done ? "未完成" : "已完成"}`}
        />
        <div className="todo-main">
          {editing ? (
            <input
              ref={editRef}
              className="edit-input"
              value={draft}
              maxLength={MAX_TEXT_LENGTH}
              aria-label={`编辑「${todo.text}」`}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitEdit();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  cancelEdit();
                }
              }}
            />
          ) : (
            <span className="text" title="双击编辑" onDoubleClick={startEdit}>
              {todo.text}
            </span>
          )}
        </div>

        {!editing && (
          <button
            type="button"
            className="icon-btn sm edit"
            onClick={startEdit}
            aria-label={`编辑「${todo.text}」`}
          >
            <PencilIcon />
          </button>
        )}
        <button
          type="button"
          className={`icon-btn sm detail-btn${detailOpen ? " active" : ""}`}
          onClick={toggleDetail}
          aria-expanded={detailOpen}
          aria-controls={detailId}
          aria-label={`设置「${todo.text}」的日期、优先级与标签`}
          title="日期与标签"
        >
          <CalendarIcon />
        </button>
        {canMove && !editing && (
          <span className="move">
            <button
              type="button"
              className="icon-btn sm"
              onClick={() => onMove(todo.id, -1)}
              disabled={index === 0}
              aria-label={`上移「${todo.text}」`}
            >
              <ChevronUpIcon />
            </button>
            <button
              type="button"
              className="icon-btn sm"
              onClick={() => onMove(todo.id, 1)}
              disabled={index === total - 1}
              aria-label={`下移「${todo.text}」`}
            >
              <ChevronDownIcon />
            </button>
          </span>
        )}
        <button
          type="button"
          className="icon-btn"
          onClick={() => onRemove(todo.id)}
          aria-label={`删除「${todo.text}」`}
        >
          <TrashIcon />
        </button>
      </div>

      {hasMeta && !editing && (
        <div className="todo-meta">
          {todo.dueAt !== undefined && (
            <span className={`due-badge${overdue ? " overdue" : ""}`}>
              {todo.done ? formatDateShort(todo.dueAt) : formatDue(todo.dueAt)}
            </span>
          )}
          {todo.priority > 0 && (
            <span className={`prio prio-${todo.priority}`}>
              {PRIORITY_LABELS[todo.priority]}优先级
            </span>
          )}
          {todo.tags.map((tag) => (
            <span className="tag" key={tag}>
              #{tag}
            </span>
          ))}
        </div>
      )}

      {detailOpen && (
        <div className="todo-detail" id={detailId} role="group" aria-label={`「${todo.text}」的日期与标签`}>
          <label className="detail-field">
            <span>截止日期</span>
            <input type="date" value={toDateInputValue(todo.dueAt)} onChange={(e) => setDueDate(e.target.value)} />
          </label>
          <label className="detail-field">
            <span>时间</span>
            <input
              type="time"
              value={toTimeInputValue(todo.dueAt)}
              onChange={(e) => setDueTime(e.target.value)}
              disabled={todo.dueAt === undefined}
              title={todo.dueAt === undefined ? "先选择截止日期" : undefined}
            />
          </label>
          <label className="detail-field">
            <span>优先级</span>
            <GlassSelect
              value={todo.priority}
              ariaLabel={`「${todo.text}」的优先级`}
              options={PRIORITY_OPTIONS.map((priority) => ({
                value: priority,
                label: PRIORITY_LABELS[priority],
              }))}
              onChange={(priority) => onPatch(todo.id, { priority })}
            />
          </label>
          <label className="detail-field detail-tags">
            <span>标签</span>
            <input
              value={tagDraft}
              placeholder="空格分隔，如 工作 周报"
              onChange={(e) => setTagDraft(e.target.value)}
              onBlur={commitTags}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitTags();
                }
              }}
            />
          </label>
          <label className="detail-field detail-notes">
            <span>备注</span>
            <textarea
              rows={2}
              value={notesDraft}
              placeholder="补充说明"
              onChange={(e) => setNotesDraft(e.target.value)}
              onBlur={commitNotes}
            />
          </label>
          {todo.dueAt !== undefined && (
            <button type="button" className="text-btn sm" onClick={() => onPatch(todo.id, { dueAt: null })}>
              清除日期
            </button>
          )}
        </div>
      )}
    </>
  );

  if (canDrag) {
    return (
      <Reorder.Item
        id={`todo-${todo.id}`}
        value={todo}
        className={`${todo.done ? "done" : ""}${highlighted ? " is-highlighted" : ""}`}
        dragListener={false}
        dragControls={controls}
        whileDrag={{ scale: 1.02 }}
        whileHover={reduced ? undefined : { y: -1 }}
        initial={reduced ? false : { opacity: 0, y: 10, scale: 0.98 }}
        animate={reduced ? undefined : { opacity: 1, y: 0, scale: 1 }}
        exit={reduced ? undefined : { opacity: 0, scale: 0.96, transition: { duration: 0.15 } }}
        transition={reduced ? { duration: 0 } : { duration: 0.22, ease: "easeOut" }}
      >
        {content}
      </Reorder.Item>
    );
  }

  return (
    <motion.li
      id={`todo-${todo.id}`}
      className={`${todo.done ? "done" : ""}${highlighted ? " is-highlighted" : ""}`}
      layout={reduced ? undefined : "position"}
      initial={reduced ? false : { opacity: 0, y: 8 }}
      animate={reduced ? undefined : { opacity: 1, y: 0 }}
      exit={reduced ? undefined : { opacity: 0, transition: { duration: 0.15 } }}
      transition={reduced ? { duration: 0 } : { duration: 0.2, ease: "easeOut" }}
    >
      {content}
    </motion.li>
  );
}

function PinIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity={active ? 1 : 0.7}
      aria-hidden="true"
    >
      <path d="M8 3h8l-1.2 6.4 3.2 2.6H6l3.2-2.6L8 3Z" />
      <path d="M12 12v8" />
    </svg>
  );
}

/** 备忘正文超过这个字数（或含换行）才需要「展开全文」 */
const MEMO_CLAMP_CHARS = 72;

/**
 * 备忘行：正文（默认 3 行截断，点开行内展开）+ 标签 + 创建时间 + 置顶 / 编辑 / 删除。
 * 删除走宿主的 toast + 撤销（A1），编辑走宿主 updateTodoText（A2），不自建一套。
 */
function MemoRow(props: {
  memo: Todo;
  now: number;
  reduced: boolean;
  highlighted: boolean;
  onTogglePin: (id: string) => void;
  onEdit: (id: string, text: string) => void;
  onRemove: (id: string) => void;
}) {
  const { memo, now, reduced, highlighted, onTogglePin, onEdit, onRemove } = props;
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState(memo.text);
  const editRef = useRef<HTMLTextAreaElement>(null);
  const escaping = useRef(false);
  const committing = useRef(false);

  useEffect(() => {
    if (!editing) return;
    const input = editRef.current;
    if (!input) return;
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }, [editing]);

  function startEdit() {
    setDraft(memo.text);
    escaping.current = false;
    committing.current = false;
    setEditing(true);
  }

  function commitEdit() {
    if (escaping.current) {
      escaping.current = false;
      return;
    }
    if (committing.current) return;
    committing.current = true;
    const next = draft.trim();
    setEditing(false);
    if (!next || next === memo.text) {
      setDraft(memo.text);
      return;
    }
    onEdit(memo.id, next);
  }

  function cancelEdit() {
    escaping.current = true;
    setDraft(memo.text);
    setEditing(false);
  }

  const html = useMemo(() => renderMarkdown(memo.text), [memo.text]);
  const clampable = memo.text.length > MEMO_CLAMP_CHARS || memo.text.includes("\n");
  const pinned = memo.pinned === true;

  return (
    <motion.li
      id={`todo-${memo.id}`}
      className={`memo-row${pinned ? " is-pinned" : ""}${highlighted ? " is-highlighted" : ""}`}
      layout={reduced ? undefined : "position"}
      initial={reduced ? false : { opacity: 0, y: 8 }}
      animate={reduced ? undefined : { opacity: 1, y: 0 }}
      exit={reduced ? undefined : { opacity: 0, transition: { duration: 0.15 } }}
      transition={reduced ? { duration: 0 } : { duration: 0.2, ease: "easeOut" }}
    >
      {editing ? (
        <div className="memo-edit">
          <textarea
            ref={editRef}
            className="edit-input memo-edit-input"
            value={draft}
            rows={4}
            maxLength={maxTextLength("memo")}
            aria-label="编辑备忘正文"
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commitEdit}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                cancelEdit();
              } else if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                event.preventDefault();
                commitEdit();
              }
            }}
          />
          <p className="memo-edit-hint">Enter 换行 · Ctrl/⌘ + Enter 保存 · Esc 取消</p>
        </div>
      ) : (
        <div
          className={`memo-body${clampable && !expanded ? " clamped" : ""}`}
          onClick={() => {
            if (clampable) setExpanded((value) => !value);
          }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )}

      <div className="memo-foot">
        <div className="memo-meta">
          {pinned && <span className="memo-pin-badge">置顶</span>}
          {memo.tags.map((tag) => (
            <span className="tag" key={tag}>
              #{tag}
            </span>
          ))}
          <span className="memo-time">
            {formatDateShort(memo.createdAt, now)} {formatTime(memo.createdAt)}
          </span>
        </div>
        {!editing && (
          <div className="memo-actions">
            {clampable && (
              <button
                type="button"
                className="text-btn sm"
                onClick={() => setExpanded((value) => !value)}
                aria-expanded={expanded}
              >
                {expanded ? "收起" : "展开全文"}
              </button>
            )}
            <button
              type="button"
              className="icon-btn sm"
              onClick={() => onTogglePin(memo.id)}
              aria-pressed={pinned}
              aria-label={pinned ? "取消置顶这条备忘" : "置顶这条备忘"}
              title={pinned ? "取消置顶" : "置顶"}
            >
              <PinIcon active={pinned} />
            </button>
            <button type="button" className="icon-btn sm" onClick={startEdit} aria-label="编辑这条备忘">
              <PencilIcon />
            </button>
            <button type="button" className="icon-btn" onClick={() => onRemove(memo.id)} aria-label="删除这条备忘">
              <TrashIcon />
            </button>
          </div>
        )}
      </div>
    </motion.li>
  );
}

export default function App() {
  const [initialRead] = useState(() => readState(window.localStorage));
  const [todos, setTodos] = useState<Todo[]>(initialRead.items);
  const [text, setText] = useState("");
  const [view, setView] = useState<View>("inbox");
  const [sort, setSort] = useState<SortMode>("manual");
  const [themePref, setThemePref] = useState<ThemePref>(() => readThemePref(window.localStorage));
  const [themePair, setThemePair] = useState<ThemePair>(() => readThemePair(window.localStorage));
  const [systemDark, setSystemDark] = useState(systemPrefersDark);
  const [announcement, setAnnouncement] = useState("");
  const [storageError, setStorageError] = useState("");
  const [notice, setNotice] = useState(() => {
    if (initialRead.status === "corrupt") return "本地数据读取失败，已备份原始数据并从空白开始。";
    if (initialRead.status === "migrated") {
      return initialRead.dropped > 0
        ? `旧版数据已升级，忽略 ${initialRead.dropped} 条无效条目。`
        : "旧版数据已自动升级。";
    }
    if (initialRead.dropped > 0) return `已忽略 ${initialRead.dropped} 条无效数据。`;
    return "";
  });
  const [undo, setUndo] = useState<{ message: string; removed: RemovedTodo[] } | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [pendingImport, setPendingImport] = useState<{
    items: Todo[];
    dropped: number;
    name: string;
  } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [entryMode, setEntryMode] = useState<EntryMode>("task");
  /* 「每日回顾」在面板内展示，batch 记录今天已经换过几批 */
  const [review, setReview] = useState<{ items: Todo[]; baseSeed: number; batch: number } | null>(null);
  const [reviewHint, setReviewHint] = useState("");
  /* 快速添加：输入变化就重解析，chips、提交按钮与 addTodo 共用同一份结果 */
  const taskParse = useMemo(() => parseQuickAdd(text, now), [text, now]);
  /* 备忘模式只认 #标签：日期 / 时间 / 优先级 token 留在正文，不产生 chips */
  const memoParse = useMemo(() => parseMemoInput(text), [text]);
  const quickAdd = entryMode === "memo" ? memoParse : taskParse;
  const { pref: motionPref, setPref: setMotionPref, reduced } = useMotionPreference();
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const settingsBtnRef = useRef<HTMLButtonElement>(null);
  const btnRefs = useRef<Partial<Record<View, HTMLButtonElement | null>>>({});
  const [pill, setPill] = useState({ x: 0, w: 0 });

  const announce = useCallback((message: string) => setAnnouncement(message), []);
  const closeSettings = useCallback(() => {
    setSettingsOpen(false);
    /* 面板卸载时焦点在关闭按钮上，先显式交还齿轮，避免落到 body */
    settingsBtnRef.current?.focus();
  }, []);

  /* 首次迁移/损坏恢复后也要落盘；正常启动时不重复写 */
  const firstWrite = useRef(true);
  useEffect(() => {
    if (firstWrite.current) {
      firstWrite.current = false;
      if (initialRead.status === "ok") return;
    }
    const result = writeState(window.localStorage, todos);
    setStorageError(result.ok ? "" : "浏览器存储不可用，修改仅保留在当前页面。");
  }, [todos, initialRead.status]);

  /* 跨标签页同步：其他标签页写入后重新读取 */
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== null && event.key !== STORAGE_KEY) return;
      const result = readState(window.localStorage);
      if (result.status !== "corrupt") {
        setTodos(result.items);
        announce("已同步其他标签页的修改");
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [announce]);

  /* 跟随系统：只影响 auto 模式，具体主题由 themePair 决定 */
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => setSystemDark(!mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  /* 每分钟刷新一次「今天」，跨过午夜后分组与逾期状态自动更新 */
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const themeId = resolveThemeId(themePref, systemDark, themePair);
  const theme = getTheme(themeId);

  useEffect(() => {
    document.documentElement.dataset.theme = themeId;
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (meta) meta.content = theme.tokens.background;
  }, [themeId, theme.tokens.background]);

  useEffect(() => {
    writeThemePref(window.localStorage, themePref);
    writeThemePair(window.localStorage, themePair);
  }, [themePref, themePair]);

  useEffect(() => {
    if (!undo) return;
    const timer = window.setTimeout(() => setUndo(null), 6000);
    return () => window.clearTimeout(timer);
  }, [undo]);

  useEffect(() => {
    if (!confirmClear) return;
    const timer = window.setTimeout(() => setConfirmClear(false), 4000);
    return () => window.clearTimeout(timer);
  }, [confirmClear]);

  /* 快捷键：/ 聚焦输入框，Ctrl/⌘ + K 搜索，Esc 清空 */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      /* Ctrl/⌘ + M 在「任务 / 备忘」两种输入模式间切换 */
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "m") {
        if (settingsOpen) return;
        e.preventDefault();
        setEntryMode((mode) => (mode === "task" ? "memo" : "task"));
        return;
      }

      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "k") {
        if (settingsOpen) return;
        e.preventDefault();
        setPaletteOpen(true);
        return;
      }

      const el = document.activeElement;
      const typing = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
      if (e.key === "/" && !typing) {
        e.preventDefault();
        inputRef.current?.focus();
      } else if (e.key === "Escape" && el === inputRef.current) {
        setText("");
        inputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [settingsOpen]);

  /* 命令面板选中任务后：滚到可见处；1.8 秒后撤掉高亮 */
  useEffect(() => {
    if (!highlightId) return;
    document
      .getElementById(`todo-${highlightId}`)
      ?.scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" });
  }, [highlightId, view, sort, reduced]);

  useEffect(() => {
    if (!highlightId) return;
    const timer = window.setTimeout(() => setHighlightId(null), 1800);
    return () => window.clearTimeout(timer);
  }, [highlightId]);

  /* 备忘不算任务：完成度、任务视图、拖拽都只看 task */
  const tasks = useMemo(() => todos.filter((todo) => !isMemo(todo)), [todos]);
  const memos = useMemo(() => todos.filter((todo) => isMemo(todo)), [todos]);
  const timeline = useMemo(() => memoTimeline(todos, startOfDay(now)), [todos, now]);

  const activeCount = tasks.filter((t) => !t.done).length;
  const doneCount = tasks.length - activeCount;
  const pct = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0;
  const clearArmed = confirmClear && doneCount > 0;

  const counts: Record<View, number> = {
    inbox: tasks.filter((t) => !t.done && t.dueAt === undefined).length,
    today: tasks.filter((t) => {
      if (t.done || t.dueAt === undefined) return false;
      const bucket = getDueBucket(t.dueAt, now);
      return bucket === "overdue" || bucket === "today";
    }).length,
    planned: tasks.filter((t) => !t.done && t.dueAt !== undefined).length,
    all: tasks.length,
    memo: memos.length,
  };

  const visible = useMemo(() => {
    if (view === "memo") return [];
    const list = tasks.filter((todo) => {
      if (view === "all") return true;
      if (todo.done) return false;
      if (view === "inbox") return todo.dueAt === undefined;
      if (view === "today") {
        const bucket = getDueBucket(todo.dueAt, now);
        return bucket === "overdue" || bucket === "today";
      }
      return todo.dueAt !== undefined;
    });

    return [...list].sort((a, b) => {
      if (sort === "due") {
        if (a.dueAt === undefined && b.dueAt === undefined) return a.order - b.order;
        if (a.dueAt === undefined) return 1;
        if (b.dueAt === undefined) return -1;
        return a.dueAt - b.dueAt || a.order - b.order;
      }
      if (sort === "priority") return b.priority - a.priority || a.order - b.order;
      if (sort === "created") return b.createdAt - a.createdAt || a.order - b.order;
      return a.order - b.order;
    });
  }, [tasks, view, sort, now]);

  const groups = useMemo(() => {
    if (view === "memo") return null;
    const shouldGroup = sort === "due" || view === "today" || view === "planned";
    if (!shouldGroup) return null;

    const map = new Map<DueBucket, Todo[]>();
    for (const todo of visible) {
      const bucket = getDueBucket(todo.dueAt, now);
      const list = map.get(bucket);
      if (list) list.push(todo);
      else map.set(bucket, [todo]);
    }
    return DUE_BUCKET_ORDER.filter((bucket) => (map.get(bucket)?.length ?? 0) > 0).map((bucket) => ({
      bucket,
      label: DUE_BUCKET_LABELS[bucket],
      items: map.get(bucket) ?? [],
    }));
  }, [visible, sort, view, now]);

  const canDrag = sort === "manual" && view === "all" && visible.length > 1;
  const canMove = sort === "manual" && visible.length > 1;

  function addEntry(e: FormEvent) {
    e.preventDefault();
    /* 只提交解析后的正文：日期 / 优先级 / 标签已经变成字段 */
    const value = quickAdd.text.trim();
    if (!value) return;
    const item = createTodo(value, Date.now(), {
      dueAt: quickAdd.dueAt,
      priority: quickAdd.priority,
      tags: quickAdd.tags,
    });
    const nextOrder = todos.reduce((max, todo) => Math.max(max, todo.order), -1) + 1;
    /* 备忘：不带日期与优先级，只留标签；记完直接进「备忘」视图，避免「记完不知道去哪了」 */
    if (entryMode === "memo") {
      const memo = createMemo(value, Date.now(), { tags: quickAdd.tags });
      setTodos([...todos, { ...memo, order: nextOrder }]);
      setText("");
      setView("memo");
      const memoExtra =
        quickAdd.tags.length > 0 ? `（${quickAdd.tags.map((tag) => `#${tag}`).join(" ")}）` : "";
      announce(`已记录备忘：${value}${memoExtra}`);
      return;
    }

    const added = { ...item, order: nextOrder };
    setTodos([...todos, added]);
    setText("");

    /* 加完看不到就跳到能看到的视图，避免「输入后凭空消失」 */
    const bucket = added.dueAt === undefined ? undefined : getDueBucket(added.dueAt, now);
    const staysVisible =
      view === "all" ||
      (view === "inbox"
        ? added.dueAt === undefined
        : view === "today"
          ? bucket === "overdue" || bucket === "today"
          : added.dueAt !== undefined);
    if (!staysVisible) setView(added.dueAt === undefined ? "inbox" : "planned");

    const extras = [
      quickAdd.dueAt !== undefined ? formatDue(quickAdd.dueAt, now) : "",
      quickAdd.priority > 0 ? `${PRIORITY_LABELS[quickAdd.priority]}优先级` : "",
      quickAdd.tags.length > 0 ? quickAdd.tags.map((tag) => `#${tag}`).join(" ") : "",
    ].filter(Boolean);
    announce(`已添加：${value}${extras.length > 0 ? `（${extras.join("，")}）` : ""}`);
  }

  /* 点掉识别项：从原始输入里删掉 token 原文，parseQuickAdd 会自动重算字段 */
  function removeQuickAddToken(index: number) {
    const token = quickAdd.tokens[index];
    if (!token) return;
    const at = text.indexOf(token.raw);
    if (at < 0) return;
    const next = `${text.slice(0, at)}${text.slice(at + token.raw.length)}`
      .replace(/[\s\u3000]{2,}/g, " ")
      .trimStart();
    setText(next);
  }

  /* 命令面板选中任务：当前视图看不到就切到「全部」，再高亮定位 */
  function pickTodo(id: string) {
    const target = todos.find((todo) => todo.id === id);
    if (target && isMemo(target)) setView("memo");
    else if (!visible.some((todo) => todo.id === id)) setView("all");
    setHighlightId(id);
  }

  function toggle(id: string) {
    const target = todos.find((t) => t.id === id);
    if (!target) return;
    const next = toggleTodo(todos, id);
    setTodos(next);
    if (!target.done) {
      burst(theme.effects.confetti, next.length > 0 && next.every((t) => t.done));
      announce(`已完成：${target.text}`);
    } else {
      announce(`已恢复：${target.text}`);
    }
  }

  function edit(id: string, nextText: string) {
    const next = updateTodoText(todos, id, nextText);
    if (next === todos) return;
    setTodos(next);
    announce(`已更新：${nextText}`);
  }

  function patch(id: string, next: TodoPatch) {
    setTodos((list) => updateTodo(list, id, next));
    announce("已更新任务信息");
  }

  function remove(id: string) {
    const result = removeTodo(todos, id);
    if (!result.removed) return;
    setTodos(result.items);
    setUndo({ message: `已删除「${result.removed.item.text}」`, removed: [result.removed] });
    announce(`已删除：${result.removed.item.text}，可撤销`);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function clearCompleted() {
    const result = clearDone(todos);
    if (result.removed.length === 0) return;
    setTodos(result.items);
    setUndo({ message: `已清除 ${result.removed.length} 条已完成`, removed: result.removed });
    announce(`已清除 ${result.removed.length} 条已完成，可撤销`);
    setConfirmClear(false);
  }

  function handleClearClick() {
    if (!clearArmed) {
      setConfirmClear(true);
      announce(`再次点击确认清除 ${doneCount} 条已完成`);
      return;
    }
    clearCompleted();
  }

  function undoLast() {
    if (!undo) return;
    setTodos((list) => restoreTodos(list, undo.removed));
    announce(`已恢复 ${undo.removed.length} 条`);
    setUndo(null);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function handleReorder(order: Todo[]) {
    if (sort !== "manual" || view !== "all") return;
    setTodos(order.map((item, index) => (item.order === index ? item : { ...item, order: index })));
  }

  function moveWithin(list: Todo[], id: string, delta: number) {
    const ids = list.map((item) => item.id);
    setTodos((items) => moveTodoAmong(items, ids, id, delta));
  }

  /* 备忘置顶：只翻转 pinned，其余字段不动 */
  function togglePin(id: string) {
    const target = todos.find((todo) => todo.id === id);
    if (!target) return;
    const next = target.pinned !== true;
    setTodos((list) => updateTodo(list, id, { pinned: next }));
    announce(next ? `已置顶：${target.text}` : `已取消置顶：${target.text}`);
  }

  /* 每日回顾：同一天种子固定（刷新不换），换一批用派生种子，每天只提示一次上限 */
  function openReview() {
    const baseSeed = dailyReviewSeed(Date.now());
    setReview({ items: dailyReview(todos, Date.now(), baseSeed), baseSeed, batch: 0 });
    setReviewHint("");
    announce(`每日回顾：抽了 ${DAILY_REVIEW_SIZE} 条旧备忘`);
  }

  function shuffleReview() {
    if (!review) return;
    if (review.batch >= 1) {
      setReviewHint("今天已经换过一批了，明天再看新的一组");
      announce("今天已经换过一批了");
      return;
    }
    const seed = reviewSeedForBatch(review.baseSeed, 1);
    setReview({ items: dailyReview(todos, Date.now(), seed), baseSeed: review.baseSeed, batch: 1 });
    setReviewHint("");
    announce("已换一批旧备忘");
  }

  function quickToggleTheme() {
    const next = toggleTheme(themeId, themePair);
    setThemePair(next.pair);
    setThemePref(next.theme);
  }

  function chooseTheme(id: ThemeId) {
    setThemePref(id);
    setThemePair((pair) =>
      getTheme(id).mode === "dark" ? { ...pair, dark: id } : { ...pair, light: id },
    );
  }

  function chooseAuto() {
    setThemePref("auto");
  }

  function exportTodos() {
    const json = serializeExport(todos);
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = exportFileName();
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    announce(`已导出 ${todos.length} 条`);
  }

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    /* 关闭面板，让预览条或错误提示回到主界面可见 */
    setSettingsOpen(false);

    let content: string;
    try {
      content = await file.text();
    } catch {
      setNotice("读取文件失败，请重试。");
      announce("读取文件失败");
      return;
    }

    const result = parseImport(content);
    if (!result.ok) {
      setNotice(result.error);
      announce(result.error);
      return;
    }
    setPendingImport({ items: result.items, dropped: result.dropped, name: file.name });
    announce(`已读取 ${result.items.length} 条，等待确认导入`);
  }

  function confirmImport() {
    if (!pendingImport) return;
    setTodos(pendingImport.items);
    setUndo(null);
    const extra = pendingImport.dropped > 0 ? `，忽略 ${pendingImport.dropped} 条无效数据` : "";
    setNotice(`已导入 ${pendingImport.items.length} 条${extra}`);
    announce(`已导入 ${pendingImport.items.length} 条`);
    setPendingImport(null);
  }

  function clearAll() {
    const count = todos.length;
    if (count === 0) return;
    setTodos([]);
    setUndo(null);
    setPendingImport(null);
    setConfirmClear(false);
    setNotice(`已清空全部 ${count} 条，可在「设置 → 数据」导入之前的备份。`);
    announce(`已清空全部 ${count} 条`);
  }

  /* 滑块定位：常驻胶囊只动 transform（合成器直出），不占主线程 */
  useLayoutEffect(() => {
    const measure = () => {
      const el = btnRefs.current[view];
      if (el) setPill({ x: el.offsetLeft, w: el.offsetWidth });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [view, counts.inbox, counts.today, counts.planned, counts.all]);

  const pillStyle = {
    transform: `translateX(${pill.x}px)`,
    width: `${pill.w}px`,
  };

  const progressWord =
    tasks.length === 0 ? "先加一条任务吧"
      : pct === 100 ? "全部搞定！"
        : pct >= 50 ? "过半啦，继续保持"
          : "开始规划今天吧";

  const emptyTitle =
    view === "today" ? "今天没有要做的"
      : view === "planned" ? "还没有排期的任务"
        : view === "inbox" ? "收件箱是空的"
          : "暂无任务";
  const emptyHint =
    view === "inbox" ? "在上方输入框添加一条吧"
      : view === "today" ? "给任务加个截止日期就会出现在这里"
        : view === "planned" ? "点任务右侧的日历按钮设置截止日期"
          : "在上方输入框添加一条吧";

  const emptyState = (
    <motion.li
      key="empty"
      className="empty"
      initial={reduced ? false : { opacity: 0, scale: 0.98 }}
      animate={reduced ? undefined : { opacity: 1, scale: 1 }}
      exit={reduced ? undefined : { opacity: 0, transition: { duration: 0.15 } }}
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      <ClipboardIcon />
      <p>{emptyTitle}</p>
      <span>{emptyHint}</span>
    </motion.li>
  );

  function renderItem(todo: Todo, index: number, total: number, list: Todo[], drag: boolean) {
    return (
      <TodoItem
        key={todo.id}
        todo={todo}
        index={index}
        total={total}
        canDrag={drag}
        canMove={canMove}
        reduced={reduced}
        highlighted={highlightId === todo.id}
        onToggle={toggle}
        onRemove={remove}
        onEdit={edit}
        onPatch={patch}
        onMove={(id, delta) => moveWithin(list, id, delta)}
      />
    );
  }

  function renderMemo(memo: Todo) {
    return (
      <MemoRow
        key={memo.id}
        memo={memo}
        now={now}
        reduced={reduced}
        highlighted={highlightId === memo.id}
        onTogglePin={togglePin}
        onEdit={edit}
        onRemove={remove}
      />
    );
  }

  const memoEmptyState = (
    <motion.li
      key="empty-memo"
      className="empty"
      initial={reduced ? false : { opacity: 0, scale: 0.98 }}
      animate={reduced ? undefined : { opacity: 1, scale: 1 }}
      exit={reduced ? undefined : { opacity: 0, transition: { duration: 0.15 } }}
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      <ClipboardIcon />
      <p>还没有备忘</p>
      <span>把输入框切到「备忘」，随手记一条想法</span>
    </motion.li>
  );

  const paletteCommands: PaletteCommand[] = [
    {
      id: "new-todo",
      label: "新建任务",
      hint: "聚焦输入框",
      run: () => requestAnimationFrame(() => inputRef.current?.focus()),
    },
    { id: "go-today", label: "查看今天", hint: "逾期与今天到期", run: () => setView("today") },
    { id: "go-all", label: "查看全部任务", hint: "含已完成", run: () => setView("all") },
    {
      id: "toggle-theme",
      label: "切换明暗主题",
      hint: theme.mode === "dark" ? "切到浅色" : "切到深色",
      run: quickToggleTheme,
    },
    { id: "open-settings", label: "打开设置", hint: "主题 · 动效 · 数据", run: () => setSettingsOpen(true) },
    { id: "export", label: "导出数据", hint: `JSON · ${todos.length} 条`, run: exportTodos },
    {
      id: "clear-done",
      label: "清除已完成",
      hint: `${doneCount} 条`,
      run: () => (doneCount > 0 ? clearCompleted() : announce("没有已完成任务")),
    },
    {
      id: "new-memo",
      label: "记录备忘",
      hint: "切到备忘模式并聚焦输入框",
      run: () => {
        setEntryMode("memo");
        setView("memo");
        requestAnimationFrame(() => inputRef.current?.focus());
      },
    },
    {
      id: "daily-review",
      label: "每日回顾",
      hint: `随机 ${DAILY_REVIEW_SIZE} 条 7 天前的备忘`,
      keepOpen: true,
      run: openReview,
    },
  ];

  const card = (
    <main className="page-main">
      <SpotlightCard
        className="card"
        theme={theme.mode}
        spotlightColor={theme.effects.spotlight}
        intensity={0.3}
        softness={0.75}
        borderGlow={0.45}
        proximity={120}
        grain={0.06}
      >
        <header className="hero">
          <div className="hero-brand">
            <img src={whimTodoLogo} alt="Whim Todo 标志" className="hero-logo" />
            <div>
              <div role="heading" aria-level={1}>
                <BlurText
                  text="待办清单"
                  animateBy="letters"
                  trigger="load"
                  delay={60}
                  blur={6}
                  distance={20}
                  stepDuration={0.3}
                  className="hero-title"
                />
              </div>
              <p>Vite + React + TypeScript 演示 · 数据保存在本地浏览器</p>
            </div>
          </div>
          <div className="header-actions">
            <button
              type="button"
              className="icon-btn"
              onClick={() => setPaletteOpen(true)}
              aria-label="搜索任务或命令"
              aria-haspopup="dialog"
              aria-expanded={paletteOpen}
              aria-keyshortcuts="Control+K Meta+K"
              title="搜索 · Ctrl/⌘ + K"
            >
              <SearchIcon />
            </button>
            <button
              type="button"
              className="icon-btn theme-toggle"
              onClick={quickToggleTheme}
              aria-label={`切换到${theme.mode === "dark" ? "浅色" : "深色"}主题`}
              title="切换明暗"
            >
              {theme.mode === "dark" ? <SunIcon /> : <MoonIcon />}
            </button>
            <button
              type="button"
              className="icon-btn theme-toggle"
              onClick={() => setSettingsOpen(true)}
              aria-label="打开设置"
              aria-haspopup="dialog"
              aria-expanded={settingsOpen}
              title="设置"
              ref={settingsBtnRef}
            >
              <GearIcon />
            </button>
          </div>
        </header>

        {(notice || storageError) && (
          <div className={`notice${storageError ? " notice-error" : ""}`} role="status">
            <span>{storageError || notice}</span>
            {!storageError && (
              <button type="button" className="icon-btn sm" onClick={() => setNotice("")} aria-label="关闭提示">
                <CloseIcon />
              </button>
            )}
          </div>
        )}

        <div className="entry-mode" role="group" aria-label="输入模式">
          <div className="segmented">
            <button type="button" aria-pressed={entryMode === "task"} onClick={() => setEntryMode("task")}>
              任务
            </button>
            <button
              type="button"
              aria-pressed={entryMode === "memo"}
              onClick={() => setEntryMode("memo")}
              aria-keyshortcuts="Control+M Meta+M"
              title="备忘模式 · Ctrl/⌘ + M 切换"
            >
              备忘
            </button>
          </div>
          <span className="entry-mode-hint">
            {entryMode === "memo" ? "只认 #标签，日期留在正文" : "支持「明天 3点 #工作」"}
            <kbd>Ctrl+M</kbd>
          </span>
        </div>

        <form className="input-row" onSubmit={addEntry}>
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={
              entryMode === "memo" ? "记一笔想法，可以带 #标签" : "要做点什么？试试「明天 3点 #工作」"
            }
            aria-label={entryMode === "memo" ? "新备忘内容" : "新待办内容"}
            maxLength={maxTextLength(entryMode)}
          />
          <button type="submit" className="btn-primary" disabled={!quickAdd.text.trim()}>
            <PlusIcon />
            {entryMode === "memo" ? "记录" : "添加"}
          </button>
        </form>

        {quickAdd.tokens.length > 0 && (
          <div className="quickadd-bar">
            <QuickAddChips parsed={quickAdd} onRemoveToken={removeQuickAddToken} />
          </div>
        )}

        {pendingImport && (
          <div className="import-bar" role="group" aria-label="确认导入">
            <span title={pendingImport.name}>
              导入 {pendingImport.items.length} 条将替换现有 {todos.length} 条
              {pendingImport.dropped > 0 ? `（忽略 ${pendingImport.dropped} 条）` : ""}
            </span>
            <div className="import-actions">
              <button type="button" className="btn-primary sm" onClick={confirmImport}>
                确认导入
              </button>
              <button type="button" className="text-btn" onClick={() => setPendingImport(null)}>
                取消
              </button>
            </div>
          </div>
        )}

        <section className="stats">
          <svg className="ring" width="56" height="56" viewBox="0 0 56 56" role="img" aria-label={`完成进度 ${pct}%`}>
            <circle className="ring-bg" cx="28" cy="28" r={RING_R} strokeWidth="6" />
            <circle
              className="ring-fg"
              cx="28" cy="28" r={RING_R}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={RING_C}
              strokeDashoffset={RING_C * (1 - pct / 100)}
              transform="rotate(-90 28 28)"
            />
            <text className="ring-text" x="28" y="32" textAnchor="middle">{pct}%</text>
          </svg>
          <div className="stats-info">
            <span className="stats-main">
              {activeCount} 项待办 ·{" "}
              {reduced ? doneCount : <CountUp key={doneCount} to={doneCount} duration={0.6} easing="expo" />}{" "}
              条已完成
            </span>
            <span className="stats-sub">
              <ShinyText
                color={theme.tokens.subtle}
                shineColor={theme.tokens.primary}
                speed={3.2}
                delay={1.2}
                trigger="loop"
                disabled={reduced}
              >
                {progressWord}
              </ShinyText>
            </span>
          </div>
        </section>

        <div className="toolbar" role="group" aria-label="切换视图">
          <div className="segmented">
            <span className="seg-pill" aria-hidden="true" style={pillStyle} />
            {VIEWS.map((v) => (
              <button
                key={v.key}
                type="button"
                ref={(el) => {
                  btnRefs.current[v.key] = el;
                }}
                aria-pressed={view === v.key}
                onClick={() => setView(v.key)}
              >
                {v.label}
                <span className="count">{counts[v.key]}</span>
              </button>
            ))}
          </div>
        </div>

        {view !== "memo" && (
        <div className="toolbar-sub">
          <label className="sort-field">
            <span>排序</span>
            <GlassSelect
              compact
              value={sort}
              ariaLabel="排序方式"
              options={SORTS.map((option) => ({ value: option.key, label: option.label }))}
              onChange={(key) => setSort(key as SortMode)}
            />
          </label>
          <button
            type="button"
            className={`text-btn sm${clearArmed ? " danger" : ""}`}
            onClick={handleClearClick}
            disabled={doneCount === 0}
          >
            {clearArmed ? `确认清除 ${doneCount} 项` : "清除已完成"}
          </button>
        </div>
        )}

        {view === "memo" ? (
          timeline.total === 0 ? (
            <ul className="list">{memoEmptyState}</ul>
          ) : (
            <>
              {timeline.pinned.length > 0 && (
                <section className="group" aria-label="置顶备忘">
                  <h3 className="group-head">
                    置顶
                    <span className="count">{timeline.pinned.length}</span>
                  </h3>
                  <ul className="list">
                    <AnimatePresence initial={false} mode="popLayout">
                      {timeline.pinned.map((memo) => renderMemo(memo))}
                    </AnimatePresence>
                  </ul>
                </section>
              )}
              {timeline.groups.map((group) => (
                <section className="group" key={group.key} aria-label={group.label}>
                  <h3 className="group-head">
                    {group.label}
                    <span className="count">{group.items.length}</span>
                  </h3>
                  <ul className="list">
                    <AnimatePresence initial={false} mode="popLayout">
                      {group.items.map((memo) => renderMemo(memo))}
                    </AnimatePresence>
                  </ul>
                </section>
              ))}
            </>
          )
        ) : canDrag ? (
          <Reorder.Group as="ul" axis="y" values={visible} onReorder={handleReorder} className="list">
            <AnimatePresence initial={false} mode="popLayout">
              {visible.map((todo, i) => renderItem(todo, i, visible.length, visible, true))}
              {visible.length === 0 && emptyState}
            </AnimatePresence>
          </Reorder.Group>
        ) : groups ? (
          groups.length === 0 ? (
            <ul className="list">{emptyState}</ul>
          ) : (
            groups.map((group) => (
              <section className="group" key={group.bucket} aria-label={group.label}>
                <h3 className="group-head">
                  {group.label}
                  <span className="count">{group.items.length}</span>
                </h3>
                <ul className="list">
                  <AnimatePresence initial={false} mode="popLayout">
                    {group.items.map((todo, i) =>
                      renderItem(todo, i, group.items.length, group.items, false),
                    )}
                  </AnimatePresence>
                </ul>
              </section>
            ))
          )
        ) : (
          <ul className="list">
            <AnimatePresence initial={false} mode="popLayout">
              {visible.map((todo, i) => renderItem(todo, i, visible.length, visible, false))}
              {visible.length === 0 && emptyState}
            </AnimatePresence>
          </ul>
        )}

        <footer className="footer">
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={handleFileChange}
          />
          <span className="credit">
            开源仓库{" "}
            <a
              href="https://github.com/Ls-WanMeng/whim-todo"
              target="_blank"
              rel="noopener noreferrer"
            >
              Ls-WanMeng/whim-todo
            </a>
            {" "}· 作者{" "}
            <a
              href="https://github.com/Ls-WanMeng"
              target="_blank"
              rel="noopener noreferrer"
            >
              挽梦遗酒
            </a>
          </span>
        </footer>
      </SpotlightCard>
    </main>
  );

  return (
    <div className="app">
      <div className="aurora-bg" aria-hidden="true">
        <ThemeScene theme={theme} reduced={reduced} />
      </div>
      {reduced ? (
        card
      ) : (
        <AnimatedContent
          trigger="mount"
          distance={24}
          blur={6}
          duration={0.7}
          ease="power3.out"
          initialOpacity={0}
          className="card-wrap"
        >
          {card}
        </AnimatedContent>
      )}
      {settingsOpen && (
        <SettingsPanel
          onClose={closeSettings}
          todoCount={todos.length}
          motionPref={motionPref}
          onMotionPrefChange={setMotionPref}
          onExport={exportTodos}
          onImport={() => fileRef.current?.click()}
          onClearAll={clearAll}
          triggerRef={settingsBtnRef}
          themePref={themePref}
          themeId={themeId}
          onChooseTheme={chooseTheme}
          onChooseAuto={chooseAuto}
        />
      )}
      <CommandPalette
        open={paletteOpen}
        onClose={() => {
          setPaletteOpen(false);
          setReview(null);
          setReviewHint("");
        }}
        items={todos}
        commands={paletteCommands}
        onPickItem={pickTodo}
        review={review}
        onShuffleReview={shuffleReview}
        reviewHint={reviewHint}
      />
      {undo && (
        <div className="toast" role="group" aria-label="操作提示">
          <span className="toast-msg">{undo.message}</span>
          <button type="button" className="toast-action" onClick={undoLast}>
            撤销
          </button>
          <button type="button" className="toast-close" onClick={() => setUndo(null)} aria-label="关闭提示">
            <CloseIcon />
          </button>
        </div>
      )}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>
    </div>
  );
}
