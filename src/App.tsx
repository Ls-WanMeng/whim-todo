import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { AnimatePresence, Reorder, motion, useDragControls } from "motion/react";
import confetti from "canvas-confetti";
import AnimatedContent from "./components/reactbits/AnimatedContent";
import BlurText from "./components/reactbits/BlurText";
import CountUp from "./components/reactbits/CountUp";
import Aurora from "./components/reactbits/Aurora";
import SpotlightCard from "./components/reactbits/SpotlightCard";
import ShinyText from "./components/reactbits/ShinyText";
import { useReducedMotion } from "./hooks/useReducedMotion";
import "./App.css";

type Todo = { id: number; text: string; done: boolean };
type Filter = "all" | "active" | "done";
type Theme = "dark" | "light";

const STORAGE_KEY = "dsh-demo-todos";
const THEME_KEY = "dsh-demo-theme";

function loadTodos(): Todo[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const data = raw ? JSON.parse(raw) : [];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function initialTheme(): Theme {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === "dark" || saved === "light") return saved;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

const CONFETTI_COLORS = ["#2dd4bf", "#fb923c", "#818cf8"];

function burst(big = false) {
  confetti({
    particleCount: big ? 140 : 28,
    spread: big ? 100 : 55,
    startVelocity: big ? 38 : 24,
    origin: { y: 0.7 },
    colors: CONFETTI_COLORS,
    disableForReducedMotion: true,
  });
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
  onToggle: (id: number) => void;
  onRemove: (id: number) => void;
  onMove: (i: number, delta: number) => void;
}) {
  const { todo, index, total, canReorder, reduced, onToggle, onRemove, onMove } = props;
  const controls = useDragControls();

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
        <span className="drag" title="拖动排序" onPointerDown={(e) => controls.start(e)}>
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
      <span className="text">{todo.text}</span>
      {canReorder && (
        <span className="move">
          <button
            type="button"
            className="icon-btn sm"
            onClick={() => onMove(index, -1)}
            disabled={index === 0}
            aria-label={`上移「${todo.text}」`}
          >
            <ChevronUpIcon />
          </button>
          <button
            type="button"
            className="icon-btn sm"
            onClick={() => onMove(index, 1)}
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
  const [todos, setTodos] = useState<Todo[]>(loadTodos);
  const [text, setText] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const reduced = useReducedMotion();
  const inputRef = useRef<HTMLInputElement>(null);
  const btnRefs = useRef<Partial<Record<Filter, HTMLButtonElement | null>>>({});
  const [pill, setPill] = useState({ x: 0, w: 0 });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
  }, [todos]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

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
    setTodos((list) => [...list, { id: Date.now(), text: value, done: false }]);
    setText("");
  }

  function toggle(id: number) {
    const target = todos.find((t) => t.id === id);
    if (!target) return;
    const next = todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t));
    setTodos(next);
    if (!target.done) burst(next.length > 0 && next.every((t) => t.done));
  }

  const remove = (id: number) => setTodos((list) => list.filter((t) => t.id !== id));
  const clearDone = () => setTodos((list) => list.filter((t) => !t.done));

  function handleReorder(order: Todo[]) {
    if (filter === "all") setTodos(order);
  }

  function move(i: number, delta: number) {
    const j = i + delta;
    if (j < 0 || j >= todos.length) return;
    setTodos((list) => {
      const next = [...list];
      const [moved] = next.splice(i, 1);
      next.splice(j, 0, moved);
      return next;
    });
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
        theme={theme}
        spotlightColor={theme === "light" ? "#0d9488" : "#2dd4bf"}
        intensity={0.3}
        softness={0.75}
        borderGlow={0.45}
        proximity={120}
        grain={0.06}
      >
        <header className="hero">
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
          <button
            type="button"
            className="icon-btn theme-toggle"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label={`切换到${theme === "dark" ? "浅色" : "深色"}主题`}
            title="切换主题"
          >
            {theme === "dark" ? <SunIcon /> : <MoonIcon />}
          </button>
        </header>

        <form className="input-row" onSubmit={addTodo}>
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="要做点什么？"
            aria-label="新待办内容"
            maxLength={100}
          />
          <button type="submit" className="btn-primary" disabled={!text.trim()}>
            <PlusIcon />
            添加
          </button>
        </form>

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
                color={theme === "light" ? "#64748b" : "#94a3b8"}
                shineColor={theme === "light" ? "#0f766e" : "#5eead4"}
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
          <button type="button" className="text-btn" onClick={clearDone} disabled={doneCount === 0}>
            清除已完成
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
          <span>
            按 <kbd>/</kbd> 聚焦输入 · <kbd>Esc</kbd> 清空 · 拖动条目或用箭头按钮排序
          </span>
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
        <Aurora
          colorStops={["#2dd4bf", "#6366f1", "#fb923c"]}
          amplitude={0.8}
          speed={0.4}
          dpr={1}
          opacity={theme === "light" ? 0.45 : 0.6}
          mouseInteraction={false}
          lightMode={theme === "light"}
          paused={reduced}
        />
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
    </div>
  );
}
