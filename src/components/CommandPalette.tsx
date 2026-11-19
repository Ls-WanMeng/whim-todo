/**
 * C4 · 搜索命令面板
 *
 * 结构：comboBox（搜索框） + listBox（命令 / 任务两组） + 脚注
 * 键盘：↑↓ 选择、Enter 执行、Esc 关闭、Tab 在面板内循环
 * 焦点：打开时进搜索框，关闭时还给打开前的元素（宿主不用传 triggerRef）
 */
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { searchItems, splitByRanges } from "../lib/search";
import type { SearchHit, SearchRange, Todo } from "../lib/search";
import { useReducedMotion } from "../hooks/useReducedMotion";
import "./CommandPalette.css";

export type PaletteCommand = {
  id: string;
  label: string;
  hint?: string;
  run: () => void;
  /* 执行后不关闭面板（「每日回顾」要在面板内展示卡片） */
  keepOpen?: boolean;
};

/** 面板内「每日回顾」要展示的数据，由宿主算好后传进来（纯函数在 lib/review.ts） */
export type PaletteReview = {
  items: Todo[];
  batch: number;
};

export type CommandPaletteProps = {
  open: boolean;
  onClose: () => void;
  items: Todo[];
  commands: PaletteCommand[];
  onPickItem: (id: string) => void;
  onSearchChange?: (query: string) => void;
  review?: PaletteReview | null;
  onShuffleReview?: () => void;
  reviewHint?: string;
};

/** 任务最多列这么多条，剩下的提示继续输入 */
const MAX_ITEM_RESULTS = 8;

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

type CommandEntry = { kind: "command"; key: string; command: PaletteCommand };
type ItemEntry = { kind: "item"; key: string; hit: SearchHit };
type Entry = CommandEntry | ItemEntry;

function SearchIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

/** 到期日展示：只到日期时不显示 00:00，跨年才带上年份 */
function formatDue(dueAt?: number): string {
  if (typeof dueAt !== "number" || !Number.isFinite(dueAt)) return "";

  const date = new Date(dueAt);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const sameYear = date.getFullYear() === new Date().getFullYear();
  const year = sameYear ? "" : `${date.getFullYear()}-`;

  const hour = date.getHours();
  const minute = date.getMinutes();
  const clock =
    hour === 0 && minute === 0
      ? ""
      : ` ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

  return `${year}${month}-${day}${clock}`;
}

function itemMeta(item: Todo): string {
  const parts: string[] = [];

  const due = formatDue(item.dueAt);
  if (due) parts.push(due);
  if (item.priority === 3) parts.push("高");
  else if (item.priority === 2) parts.push("中");

  const tags = Array.isArray(item.tags) ? item.tags : [];
  if (tags.length > 0) {
    const shown = tags.slice(0, 2).map((tag) => `#${tag}`).join(" ");
    parts.push(tags.length > 2 ? `${shown} +${tags.length - 2}` : shown);
  }
  if (item.done) parts.push("已完成");

  return parts.join(" · ");
}

export default function CommandPalette(props: CommandPaletteProps) {
  const { open, onClose, items, commands, onPickItem, onSearchChange } = props;
  const { review, onShuffleReview, reviewHint } = props;

  const reduced = useReducedMotion();
  const titleId = useId();
  const listId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<(HTMLDivElement | null)[]>([]);

  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  /* 回调放 ref：宿主传内联函数时不会因为依赖变化反复重开面板 */
  const searchChangeRef = useRef(onSearchChange);
  useEffect(() => {
    searchChangeRef.current = onSearchChange;
  }, [onSearchChange]);

  /* 打开：锁滚动、聚焦输入框；关闭时把焦点还给打开前的元素 */
  useEffect(() => {
    if (!open) return;

    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    searchChangeRef.current?.("");

    const raf = requestAnimationFrame(() => inputRef.current?.focus());

    return () => {
      cancelAnimationFrame(raf);
      document.body.style.overflow = previousOverflow;
      opener?.focus?.();
    };
  }, [open]);

  const commandEntries = useMemo<CommandEntry[]>(() => {
    const needle = query.trim().toLowerCase();
    const matched = needle
      ? commands.filter(
          (command) =>
            command.label.toLowerCase().includes(needle) ||
            (command.hint ?? "").toLowerCase().includes(needle),
        )
      : commands;

    return matched.map((command) => ({ kind: "command", key: `command:${command.id}`, command }));
  }, [commands, query]);

  const hits = useMemo<SearchHit[]>(
    () => (query.trim() ? searchItems(items, query) : []),
    [items, query],
  );

  const itemEntries = useMemo<ItemEntry[]>(
    () =>
      hits.slice(0, MAX_ITEM_RESULTS).map((hit) => ({
        kind: "item" as const,
        key: `item:${hit.item.id}`,
        hit,
      })),
    [hits],
  );

  const flat = useMemo<Entry[]>(
    () => [...commandEntries, ...itemEntries],
    [commandEntries, itemEntries],
  );

  /* 选中项滚进可视区（active 只是参考值，越界时用收敛后的 activeIndex） */
  useEffect(() => {
    if (!open) return;
    optionRefs.current[Math.max(0, active)]?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  if (!open) return null;

  const optionId = (index: number) => `${listId}-option-${index}`;
  const hasQuery = query.trim().length > 0;
  const isEmpty = flat.length === 0;
  const activeIndex = flat.length === 0 ? -1 : Math.min(active, flat.length - 1);

  /** 关闭统一走这里：清空搜索词、通知宿主、交还焦点由 effect 清理时处理 */
  function close() {
    setQuery("");
    setActive(0);
    searchChangeRef.current?.("");
    onClose();
  }

  function activate(entry: Entry) {
    if (entry.kind === "command") {
      entry.command.run();
      if (entry.command.keepOpen) {
        /* 留在面板里：清掉旧搜索词，让回顾卡片独占视野 */
        setQuery("");
        setActive(0);
        return;
      }
    } else {
      onPickItem(entry.hit.item.id);
    }
    close();
  }

  function handleQueryChange(value: string) {
    setQuery(value);
    setActive(0);
    onSearchChange?.(value);
  }

  function trapTab(event: ReactKeyboardEvent<HTMLDivElement>) {
    const root = panelRef.current;
    if (!root) return;

    const focusables = [...root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)].filter(
      (el) => el.offsetParent !== null,
    );
    if (focusables.length === 0) {
      event.preventDefault();
      return;
    }

    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    // 输入法组词期间（含 ↑↓ 选候选、回车/ESC 上屏）一律交给 IME，别抢键
    if (event.nativeEvent.isComposing) return;

    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }

    if (event.key === "Tab") {
      trapTab(event);
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (flat.length === 0) return;
      event.preventDefault();
      setActive((prev) => {
        const step = event.key === "ArrowDown" ? 1 : -1;
        return (prev + step + flat.length) % flat.length;
      });
      return;
    }

    if (event.key === "Home" || event.key === "End") {
      if (flat.length === 0) return;
      event.preventDefault();
      setActive(event.key === "Home" ? 0 : flat.length - 1);
      return;
    }

    if (event.key === "Enter") {
      // 焦点在按钮上时让按钮自己响应，别抢走 Enter
      if (event.target instanceof HTMLButtonElement) return;
      const entry = flat[activeIndex];
      if (!entry) return;
      event.preventDefault();
      activate(entry);
    }
  }

  function renderHighlighted(text: string, ranges: SearchRange[]) {
    return splitByRanges(text, ranges).map((segment, index) =>
      segment.match ? (
        <mark key={`m${index}`} className="palette-mark">
          {segment.text}
        </mark>
      ) : (
        <span key={`t${index}`}>{segment.text}</span>
      ),
    );
  }

  function optionClass(index: number, done = false) {
    return [
      "palette-option",
      index === activeIndex ? "active" : "",
      done ? "is-done" : "",
    ]
      .filter(Boolean)
      .join(" ");
  }

  return (
    <div
      className="palette-scrim"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div
        ref={panelRef}
        className={`palette${reduced ? " palette-reduced" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={handleKeyDown}
      >
        <h2 id={titleId} className="sr-only">
          搜索任务、备忘与命令
        </h2>

        <div className="palette-search">
          <span className="palette-search-icon" aria-hidden="true">
            <SearchIcon />
          </span>
          <input
            ref={inputRef}
            className="palette-input"
            value={query}
            onChange={(event) => handleQueryChange(event.target.value)}
            type="text"
            role="combobox"
            aria-expanded={open}
            aria-controls={isEmpty ? undefined : listId}
            aria-autocomplete="list"
            aria-activedescendant={activeIndex >= 0 ? optionId(activeIndex) : undefined}
            aria-label="搜索任务或命令"
            placeholder="搜索任务、备忘或命令…"
            autoComplete="off"
            spellCheck={false}
          />
          <button type="button" className="palette-close" onClick={() => close()} aria-label="关闭搜索面板">
            <CloseIcon />
          </button>
        </div>

        {review && (
          <section className="palette-review" aria-label="每日回顾">
            <div className="palette-review-head">
              <h3>每日回顾</h3>
              <span className="palette-review-sub">
                7 天前的旧备忘 · 第 {review.batch + 1} 批
              </span>
            </div>
            {review.items.length === 0 ? (
              <p className="palette-hint">还没有创建满 7 天的备忘，过几天再来回顾。</p>
            ) : (
              <ul className="palette-review-list">
                {review.items.map((item) => (
                  <li key={item.id} className="palette-review-item">
                    <span className="palette-review-text">{item.text}</span>
                    <span className="palette-review-meta">记于 {formatDue(item.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="palette-review-actions">
              <button type="button" className="palette-review-shuffle" onClick={onShuffleReview}>
                换一批
              </button>
              {reviewHint && (
                <span className="palette-review-hint" role="status">
                  {reviewHint}
                </span>
              )}
            </div>
          </section>
        )}

        <div className="palette-body">
          {isEmpty ? (
            <p className="palette-empty" role="status">
              {hasQuery ? "没有匹配的命令或任务" : "暂无可用的命令"}
            </p>
          ) : (
            <div id={listId} className="palette-list" role="listbox" aria-labelledby={titleId}>
              {commandEntries.length > 0 && (
                <div className="palette-group" role="group" aria-label="命令">
                  <p className="palette-group-title" aria-hidden="true">
                    命令
                  </p>
                  {commandEntries.map((entry, index) => (
                    <div
                      key={entry.key}
                      id={optionId(index)}
                      role="option"
                      aria-selected={index === activeIndex}
                      className={optionClass(index)}
                      ref={(el) => {
                        optionRefs.current[index] = el;
                      }}
                      onMouseDown={(event) => event.preventDefault()}
                      onMouseEnter={() => setActive(index)}
                      onClick={() => activate(entry)}
                    >
                      <span className="palette-option-main">{entry.command.label}</span>
                      {entry.command.hint && (
                        <span className="palette-option-meta">{entry.command.hint}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {hasQuery && (
                <div className="palette-group" role="group" aria-label="任务与备忘">
                  <p className="palette-group-title" aria-hidden="true">
                    任务与备忘
                  </p>
                  {itemEntries.length === 0 ? (
                    <p className="palette-hint">没有匹配的任务或备忘</p>
                  ) : (
                    itemEntries.map((entry, indexInGroup) => {
                      const index = commandEntries.length + indexInGroup;
                      return (
                        <div
                          key={entry.key}
                          id={optionId(index)}
                          role="option"
                          aria-selected={index === activeIndex}
                          className={optionClass(index, entry.hit.item.done)}
                          ref={(el) => {
                            optionRefs.current[index] = el;
                          }}
                          onMouseDown={(event) => event.preventDefault()}
                          onMouseEnter={() => setActive(index)}
                          onClick={() => activate(entry)}
                        >
                          <span className="palette-option-main">
                            {entry.hit.item.type === "memo" && (
                              <span className="palette-badge">备忘</span>
                            )}
                            {renderHighlighted(entry.hit.item.text, entry.hit.ranges)}
                          </span>
                          <span className="palette-option-meta">{itemMeta(entry.hit.item)}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {!hasQuery && <p className="palette-hint">输入关键词可以搜索任务与备忘</p>}
            </div>
          )}
        </div>

        <footer className="palette-foot">
          <span className="palette-keys">
            <kbd>↑</kbd>
            <kbd>↓</kbd> 选择 · <kbd>Enter</kbd> 执行 · <kbd>Esc</kbd> 关闭
          </span>
          {hits.length > itemEntries.length ? (
            <span className="palette-count">
              还有 {hits.length - itemEntries.length} 条匹配，继续输入以缩小范围
            </span>
          ) : (
            <span className="palette-count">{activeIndex >= 0 ? `${activeIndex + 1}/${flat.length}` : ""}</span>
          )}
        </footer>
      </div>
    </div>
  );
}
