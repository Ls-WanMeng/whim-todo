import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { AnimatePresence, Reorder, motion, useDragControls } from "motion/react";
import confetti from "canvas-confetti";
import AnimatedContent from "./components/reactbits/AnimatedContent";
import BlurText from "./components/reactbits/BlurText";
import CountUp from "./components/reactbits/CountUp";
import SpotlightCard from "./components/reactbits/SpotlightCard";
import ShinyText from "./components/reactbits/ShinyText";
import whimTodoLogo from "./assets/whim-todo-logo.svg";
import SettingsPanel from "./components/SettingsPanel";
import ThemeScene from "./components/ThemeScene";
import { useMotionPreference } from "./hooks/useMotionPreference";
import {
  MAX_TEXT_LENGTH,
  STORAGE_KEY,
  clearDone,
  createTodo,
  exportFileName,
  moveTodo,
  parseImport,
  readState,
  removeTodo,
  restoreTodos,
  serializeExport,
  toggleTodo,
  updateTodoText,
  writeState,
} from "./lib/todoStore";
import type { RemovedTodo, Todo } from "./lib/todoStore";
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
import "./App.css";

type Filter = "all" | "active" | "done";

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

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "active", label: "待办" },
  { key: "done", label: "已完成" },
];

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
  canReorder: boolean;
  reduced: boolean;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
  onEdit: (id: string, text: string) => void;
  onMove: (id: string, delta: number) => void;
}) {
  const { todo, index, total, canReorder, reduced, onToggle, onRemove, onEdit, onMove } = props;
  const controls = useDragControls();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(todo.text);
  const editRef = useRef<HTMLInputElement>(null);
  const escaping = useRef(false);
  const committing = useRef(false);

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

  return (
    <Reorder.Item
      value={todo}
      className={todo.done ? "done" : ""}
      dragListener={false}
      dragControls={controls}
      whileDrag={{ scale: 1.02 }}
      whileHover={canReorder && !reduced ? { y: -1 } : undefined}
      initial={reduced ? false : { opacity: 0, y: 10, scale: 0.98 }}
      animate={reduced ? undefined : { opacity: 1, y: 0, scale: 1 }}
      exit={reduced ? undefined : { opacity: 0, scale: 0.96, transition: { duration: 0.15 } }}
      transition={reduced ? { duration: 0 } : { duration: 0.22, ease: "easeOut" }}
    >
      {canReorder && (
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
      {canReorder && !editing && (
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
    </Reorder.Item>
  );
}

export default function App() {
  const [initialRead] = useState(() => readState(window.localStorage));
  const [todos, setTodos] = useState<Todo[]>(initialRead.items);
  const [text, setText] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
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
  const [pendingImport, setPendingImport] = useState<{
    items: Todo[];
    dropped: number;
    name: string;
  } | null>(null);
  const { pref: motionPref, setPref: setMotionPref, reduced } = useMotionPreference();
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const settingsBtnRef = useRef<HTMLButtonElement>(null);
  const btnRefs = useRef<Partial<Record<Filter, HTMLButtonElement | null>>>({});
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

  /* 快捷键：/ 聚焦输入框，Esc 清空 */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
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
  }, []);

  const activeCount = todos.filter((t) => !t.done).length;
  const doneCount = todos.length - activeCount;
  const pct = todos.length ? Math.round((doneCount / todos.length) * 100) : 0;
  const clearArmed = confirmClear && doneCount > 0;

  const visible = useMemo(() => {
    if (filter === "active") return todos.filter((t) => !t.done);
    if (filter === "done") return todos.filter((t) => t.done);
    return todos;
  }, [todos, filter]);

  const canReorder = filter === "all" && visible.length > 1;

  function addTodo(e: FormEvent) {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    const item = createTodo(value);
    const nextOrder = todos.reduce((max, todo) => Math.max(max, todo.order), -1) + 1;
    setTodos([...todos, { ...item, order: nextOrder }]);
    setText("");
    announce(`已添加：${value}`);
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
    if (filter !== "all") return;
    setTodos(order.map((item, index) => (item.order === index ? item : { ...item, order: index })));
  }

  function move(id: string, delta: number) {
    setTodos((list) => moveTodo(list, id, delta));
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

  const counts: Record<Filter, number> = {
    all: todos.length,
    active: activeCount,
    done: doneCount,
  };

  /* 滑块定位：常驻胶囊只动 transform（合成器直出），不占主线程 */
  useLayoutEffect(() => {
    const measure = () => {
      const el = btnRefs.current[filter];
      if (el) setPill({ x: el.offsetLeft, w: el.offsetWidth });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [filter, counts.all, counts.active, counts.done]);

  const pillStyle = {
    transform: `translateX(${pill.x}px)`,
    width: `${pill.w}px`,
  };

  const progressWord =
    todos.length === 0 ? "先加一条任务吧"
      : pct === 100 ? "全部搞定！"
        : pct >= 50 ? "过半啦，继续保持"
          : "开始规划今天吧";

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

        <form className="input-row" onSubmit={addTodo}>
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="要做点什么？"
            aria-label="新待办内容"
            maxLength={MAX_TEXT_LENGTH}
          />
          <button type="submit" className="btn-primary" disabled={!text.trim()}>
            <PlusIcon />
            添加
          </button>
        </form>

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

        <div className="toolbar">
          <div className="segmented" role="group" aria-label="筛选待办">
            <span className="seg-pill" aria-hidden="true" style={pillStyle} />
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                ref={(el) => {
                  btnRefs.current[f.key] = el;
                }}
                aria-pressed={filter === f.key}
                onClick={() => setFilter(f.key)}
              >
                {f.label}
                <span className="count">{counts[f.key]}</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            className={`text-btn${clearArmed ? " danger" : ""}`}
            onClick={handleClearClick}
            disabled={doneCount === 0}
          >
            {clearArmed ? `确认清除 ${doneCount} 项` : "清除已完成"}
          </button>
        </div>

        <Reorder.Group
          as="ul"
          axis="y"
          values={visible}
          onReorder={handleReorder}
          className="list"
        >
          <AnimatePresence initial={false} mode="popLayout">
            {visible.map((todo, i) => (
              <TodoItem
                key={todo.id}
                todo={todo}
                index={i}
                total={visible.length}
                canReorder={canReorder}
                reduced={reduced}
                onToggle={toggle}
                onRemove={remove}
                onEdit={edit}
                onMove={move}
              />
            ))}
            {visible.length === 0 && (
              <motion.li
                key="empty"
                className="empty"
                initial={reduced ? false : { opacity: 0, scale: 0.98 }}
                animate={reduced ? undefined : { opacity: 1, scale: 1 }}
                exit={reduced ? undefined : { opacity: 0, transition: { duration: 0.15 } }}
                transition={{ duration: 0.2, ease: "easeOut" }}
              >
                <ClipboardIcon />
                <p>{filter === "done" ? "还没有已完成的任务" : "暂无任务"}</p>
                <span>在上方输入框添加一条吧</span>
              </motion.li>
            )}
          </AnimatePresence>
        </Reorder.Group>

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
