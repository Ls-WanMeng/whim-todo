import type { ParsedQuickAdd, QuickAddTokenKind } from "../lib/quickAdd";
import "./QuickAddChips.css";

export type QuickAddChipsProps = {
  /** 解析结果，组件只负责展示与删除，不自己解析 */
  parsed: ParsedQuickAdd;
  /** 点掉第 index 个识别项：宿主用 removeQuickAddToken(parsed, index) 回填新的 parsed */
  onRemoveToken: (index: number) => void;
};

const KIND_LABEL: Record<QuickAddTokenKind, string> = {
  date: "日期",
  time: "时间",
  priority: "优先级",
  tag: "标签",
  repeat: "重复",
};

function CloseIcon() {
  return (
    <svg
      className="quickadd-chip-x"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

export default function QuickAddChips({ parsed, onRemoveToken }: QuickAddChipsProps) {
  const { tokens } = parsed;
  if (tokens.length === 0) return null;

  return (
    <div className="quickadd-chips" role="group" aria-label="已识别的快捷输入">
      {tokens.map((token, index) => {
        const hint = `移除${KIND_LABEL[token.kind]}「${token.label}」`;
        return (
          <button
            key={`${token.kind}-${token.raw}-${index}`}
            type="button"
            className={`quickadd-chip kind-${token.kind}`}
            onClick={() => onRemoveToken(index)}
            aria-label={hint}
            title={hint}
          >
            <span className="quickadd-chip-label">{token.label}</span>
            <CloseIcon />
          </button>
        );
      })}
    </div>
  );
}
