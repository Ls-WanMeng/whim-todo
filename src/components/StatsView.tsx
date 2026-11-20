import { useMemo } from "react";
import { buildStatsOverview, summarizeOverview } from "../lib/statsView";
import type { StatsOverview } from "../lib/statsView";
import type { Todo } from "../lib/todoStore";
import "./StatsView.css";

/**
 * 统计视图（Sprint D）：概览卡 + 周热力图 + 标签完成率 + 周报导出。
 * 纯展示，只读当前数据；所有颜色走主题 CSS 变量（--color-*），不新增色值。
 */
export default function StatsView(props: {
  todos: Todo[];
  now: number;
  onExportWeekly: () => void;
}) {
  const { todos, now, onExportWeekly } = props;

  const overview: StatsOverview = useMemo(
    () => buildStatsOverview(todos, now),
    [todos, now],
  );

  const summary = useMemo(() => summarizeOverview(overview), [overview]);

  /* 概览卡四项 */
  const cards = [
    { label: "连续完成", value: `${overview.streakDays}`, unit: "天", tone: "streak" },
    { label: "本周完成", value: `${overview.weekCompleted}`, unit: "项", tone: "week" },
    { label: "待办中", value: `${overview.openCount}`, unit: "项", tone: "open" },
    { label: "逾期", value: `${overview.overdueCount}`, unit: "项", tone: "overdue" },
  ];

  return (
    <section className="stats-view" aria-label="统计">
      <div className="sr-only" aria-live="polite">
        {summary}
      </div>

      {/* 概览卡 */}
      <div className="stats-cards">
        {cards.map((card) => (
          <div
            key={card.label}
            className={`stats-card${overview.overdueCount > 0 && card.tone === "overdue" ? " is-alert" : ""}`}
          >
            <span className="stats-card-value">
              {card.value}
              <span className="stats-card-unit">{card.unit}</span>
            </span>
            <span className="stats-card-label">{card.label}</span>
          </div>
        ))}
      </div>

      {/* 周热力图 */}
      <div className="stats-block">
        <div className="stats-block-head">
          <h3 className="stats-block-title">完成热力图</h3>
          <span className="stats-block-sub">近 {overview.heatmap.columns.length} 周</span>
        </div>
        <div className="heatmap" role="img" aria-label={`完成热力图，${summary}`}>
          <div className="heatmap-grid">
            {overview.heatmap.columns.map((column) => (
              <div className="heatmap-col" key={column.label}>
                {column.cells.map((cell) => (
                  <span
                    key={cell.day}
                    className={`heat-cell heat-cell-${cell.level}`}
                    title={`${column.label} · 完成 ${cell.count} 项`}
                    aria-hidden="true"
                  />
                ))}
              </div>
            ))}
          </div>
          <div className="heatmap-legend" aria-hidden="true">
            <span className="heatmap-legend-label">少</span>
            {overview.heatmap.legend.map((entry) => (
              <span key={entry.level} className={`heat-cell heat-cell-${entry.level}`} />
            ))}
            <span className="heatmap-legend-label">多</span>
          </div>
        </div>
      </div>

      {/* 标签完成率 */}
      <div className="stats-block">
        <div className="stats-block-head">
          <h3 className="stats-block-title">标签完成率</h3>
          <span className="stats-block-sub">按完成数排序</span>
        </div>
        {overview.tags.length === 0 ? (
          <p className="stats-empty">还没有带标签的任务，给任务加个 #标签 就能在这里看到完成率。</p>
        ) : (
          <ul className="tag-stats">
            {overview.tags.map((tag) => (
              <li className="tag-stat" key={tag.tag}>
                <div className="tag-stat-row">
                  <span className="tag-stat-name">#{tag.tag}</span>
                  <span className="tag-stat-nums">
                    {tag.done} / {tag.total}
                  </span>
                </div>
                <div
                  className="tag-stat-bar"
                  role="img"
                  aria-label={`#${tag.tag} 完成率 ${tag.rate}%`}
                >
                  <span
                    className="tag-stat-fill"
                    style={{ width: `${Math.min(100, tag.rate)}%` }}
                  />
                </div>
                <span className="tag-stat-rate">{tag.rate}%</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 周报导出 */}
      <div className="stats-block stats-export">
        <p className="stats-export-text">
          把本周的完成数、逾期数、标签分布一键导出成 Markdown，方便归档或分享。
        </p>
        <button
          type="button"
          className="btn-primary"
          onClick={onExportWeekly}
        >
          导出周报（Markdown）
        </button>
      </div>
    </section>
  );
}
