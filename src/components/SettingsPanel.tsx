import { useEffect, useId, useRef, useState } from "react";
import type { RefObject } from "react";
import { APP_VERSION, AUTHOR_NAME, AUTHOR_URL, REPO_URL } from "../lib/appInfo";
import { THEMES, getTheme } from "../lib/themes";
import type { ThemeId, ThemePref } from "../lib/themes";
import type { MotionPref } from "../lib/prefs";

const MOTION_OPTIONS: { value: MotionPref; label: string; hint: string }[] = [
  { value: "system", label: "跟随系统", hint: "系统开启「减弱动态效果」时自动降级" },
  { value: "reduced", label: "精简动效", hint: "关闭极光、彩带与过渡动画" },
  { value: "full", label: "全开动效", hint: "保留全部动画，不受系统设置影响" },
];

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

type Props = {
  onClose: () => void;
  todoCount: number;
  motionPref: MotionPref;
  onMotionPrefChange: (pref: MotionPref) => void;
  onExport: () => void;
  onImport: () => void;
  onClearAll: () => void;
  triggerRef?: RefObject<HTMLButtonElement | null>;
  themePref: ThemePref;
  themeId: ThemeId;
  onChooseTheme: (id: ThemeId) => void;
  onChooseAuto: () => void;
};

export default function SettingsPanel(props: Props) {
  const {
    onClose,
    todoCount,
    motionPref,
    onMotionPrefChange,
    onExport,
    onImport,
    onClearAll,
    triggerRef,
    themePref,
    themeId,
    onChooseTheme,
    onChooseAuto,
  } = props;
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  /* 挂载即打开：锁滚动、聚焦面板；卸载时还原焦点到齿轮按钮 */
  useEffect(() => {
    const opener = triggerRef?.current ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const raf = requestAnimationFrame(() => closeRef.current?.focus());

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const root = panelRef.current;
      if (!root) return;
      const focusables = [...root.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
      )].filter((el) => el.offsetParent !== null);
      if (focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      opener?.focus?.();
    };
  }, [onClose, triggerRef]);

  /* 清空确认 4 秒自动收回 */
  useEffect(() => {
    if (!confirmClear) return;
    const timer = window.setTimeout(() => setConfirmClear(false), 4000);
    return () => window.clearTimeout(timer);
  }, [confirmClear]);

  function handleClearAll() {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    onClearAll();
    setConfirmClear(false);
  }

  return (
    <div
      className="settings-scrim"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="settings-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={panelRef}
      >
        <header className="settings-head">
          <h2 id={titleId}>设置</h2>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label="关闭设置"
            ref={closeRef}
          >
            <CloseIcon />
          </button>
        </header>

        <div className="settings-body">
          <section className="settings-section" aria-labelledby="settings-appearance">
            <h3 id="settings-appearance">外观</h3>
            <div className="motion-pref" role="radiogroup" aria-labelledby="settings-appearance">
              {MOTION_OPTIONS.map((option) => (
                <label key={option.value} className="motion-option">
                  <input
                    type="radio"
                    name="motion-pref"
                    value={option.value}
                    checked={motionPref === option.value}
                    onChange={() => onMotionPrefChange(option.value)}
                  />
                  <span className="motion-label">{option.label}</span>
                  <span className="motion-hint">{option.hint}</span>
                </label>
              ))}
            </div>
            <div className="settings-sub">
              <h4 id="settings-theme">主题</h4>
              <div className="theme-grid" role="radiogroup" aria-labelledby="settings-theme">
                <label className={`theme-card${themePref === "auto" ? " selected" : ""}`}>
                  <input
                    type="radio"
                    name="theme-pref"
                    value="auto"
                    checked={themePref === "auto"}
                    onChange={onChooseAuto}
                  />
                  <span className="theme-swatch theme-swatch-auto" aria-hidden="true" />
                  <span className="theme-name">跟随系统</span>
                  <span className="theme-mode">自动</span>
                </label>
                {THEMES.map((item) => (
                  <label
                    key={item.id}
                    className={`theme-card${themePref === item.id ? " selected" : ""}`}
                  >
                    <input
                      type="radio"
                      name="theme-pref"
                      value={item.id}
                      checked={themePref === item.id}
                      onChange={() => onChooseTheme(item.id)}
                    />
                    <span
                      className="theme-swatch"
                      aria-hidden="true"
                      style={{ background: item.tokens.background }}
                    >
                      <i style={{ background: item.tokens.primary }} />
                      <i style={{ background: item.tokens.accent }} />
                      <i style={{ background: item.tokens.foreground }} />
                    </span>
                    <span className="theme-name">{item.label}</span>
                    <span className="theme-mode">{item.mode === "dark" ? "深色" : "浅色"}</span>
                  </label>
                ))}
              </div>
              <p className="settings-note">
                当前生效：{getTheme(themeId).label}
                {themePref === "auto" ? "（跟随系统）" : ""}
              </p>
            </div>
          </section>

          <section className="settings-section" aria-labelledby="settings-data">
            <h3 id="settings-data">数据</h3>
            <div className="settings-row">
              <div className="settings-row-text">
                <strong>导出 JSON</strong>
                <span>备份到本地文件，文件名带日期</span>
              </div>
              <button type="button" className="btn-secondary sm" onClick={onExport} disabled={todoCount === 0}>
                导出
              </button>
            </div>
            <div className="settings-row">
              <div className="settings-row-text">
                <strong>导入 JSON</strong>
                <span>会替换当前数据，导入前可预览条数</span>
              </div>
              <button type="button" className="btn-secondary sm" onClick={onImport}>
                选择文件
              </button>
            </div>
            <div className="settings-row">
              <div className="settings-row-text">
                <strong>清空全部数据</strong>
                <span>当前共 {todoCount} 条，建议先导出备份</span>
              </div>
              <button
                type="button"
                className={`text-btn sm${confirmClear ? " danger" : ""}`}
                onClick={handleClearAll}
                disabled={todoCount === 0}
              >
                {confirmClear ? `确认清空 ${todoCount} 条` : "清空"}
              </button>
            </div>
          </section>

          <section className="settings-section" aria-labelledby="settings-about">
            <h3 id="settings-about">关于</h3>
            <dl className="settings-about">
              <div>
                <dt>版本</dt>
                <dd>v{APP_VERSION}</dd>
              </div>
              <div>
                <dt>开源仓库</dt>
                <dd>
                  <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
                    Ls-WanMeng/whim-todo
                  </a>
                </dd>
              </div>
              <div>
                <dt>作者</dt>
                <dd>
                  <a href={AUTHOR_URL} target="_blank" rel="noopener noreferrer">
                    {AUTHOR_NAME}
                  </a>
                </dd>
              </div>
              <div>
                <dt>快捷键</dt>
                <dd>
                  <kbd>/</kbd> 聚焦输入 · <kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>K</kbd> 搜索 · <kbd>Esc</kbd> 清空 · 双击文字编辑
                </dd>
              </div>
              <div>
                <dt>操作提示</dt>
                <dd>拖动条目或使用箭头按钮排序 · 删除与清除已完成可在 6 秒内撤销</dd>
              </div>
            </dl>
            <p className="settings-note">数据只保存在当前浏览器的 localStorage，不会上传到任何服务器。</p>
          </section>
        </div>
      </div>
    </div>
  );
}
