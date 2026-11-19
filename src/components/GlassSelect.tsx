import { useEffect, useId, useRef, useState } from "react";
import "./GlassSelect.css";

export type GlassSelectOption<V extends string | number> = {
  value: V;
  label: string;
};

type Props<V extends string | number> = {
  value: V;
  options: GlassSelectOption<V>[];
  onChange: (value: V) => void;
  /** 无障碍名称（弹层与触发器的 aria） */
  ariaLabel: string;
  /** 紧凑模式（工具栏用） */
  compact?: boolean;
  disabled?: boolean;
};

function ChevronIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 4.5l3 3 3-3" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 12l6 6L20 6" />
    </svg>
  );
}

/**
 * 主题化下拉：按钮触发器 + 玻璃弹出菜单，全部走主题 token。
 * 替代原生 <select>（其弹层由操作系统绘制，无法融入玻璃主题）。
 * 键盘：ArrowDown/ArrowUp 打开；菜单内方向键循环、Home/End 跳边界、Esc 关回焦点；
 * 点击外部或 Tab 关闭。reduced-motion 下无展开动画（CSS 处理）。
 */
export default function GlassSelect<V extends string | number>({
  value,
  options,
  onChange,
  ariaLabel,
  compact,
  disabled,
}: Props<V>) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();

  const current = options.find((option) => option.value === value) ?? options[0];

  // 打开时把选中项滚动到可见
  useEffect(() => {
    if (!open || !listRef.current) return;
    const active = listRef.current.querySelector("[aria-selected='true']");
    if (active instanceof HTMLElement) {
      active.scrollIntoView({ block: "nearest" });
    }
  }, [open]);

  // Esc / 点击外部关闭
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        setOpen(false);
        btnRef.current?.focus();
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return;
      if (!wrapRef.current?.contains(event.target)) setOpen(false);
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  function move(delta: number | "first" | "last") {
    if (!listRef.current) return;
    const items = Array.from(
      listRef.current.querySelectorAll<HTMLElement>("[role='option']"),
    );
    if (items.length === 0) return;

    const index = items.findIndex((item) => item.getAttribute("aria-selected") === "true");
    const nextIndex =
      delta === "first" ? 0 : delta === "last" ? items.length - 1 : (index + delta + items.length) % items.length;
    const next = items[nextIndex];

    items.forEach((item) => item.setAttribute("aria-selected", "false"));
    next.setAttribute("aria-selected", "true");
    next.scrollIntoView({ block: "nearest" });
    onChange(options[nextIndex].value);
  }

  function onMenuKeyDown(event: React.KeyboardEvent) {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        move(1);
        break;
      case "ArrowUp":
        event.preventDefault();
        move(-1);
        break;
      case "Home":
        event.preventDefault();
        move("first");
        break;
      case "End":
        event.preventDefault();
        move("last");
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        setOpen(false);
        btnRef.current?.focus();
        break;
      case "Tab":
        setOpen(false);
        break;
    }
  }

  return (
    <div className={`glass-select${compact ? " compact" : ""}`} ref={wrapRef}>
      <button
        type="button"
        ref={btnRef}
        className="glass-select-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <span className="glass-select-value">{current?.label}</span>
        <ChevronIcon />
      </button>

      {open && (
        <ul
          className="glass-select-menu"
          id={listId}
          role="listbox"
          aria-label={ariaLabel}
          ref={listRef}
          tabIndex={-1}
          onKeyDown={onMenuKeyDown}
        >
          {options.map((option) => (
            <li
              key={String(option.value)}
              role="option"
              aria-selected={option.value === value}
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
                btnRef.current?.focus();
              }}
            >
              <span>{option.label}</span>
              {option.value === value && <CheckIcon />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
