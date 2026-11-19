# PLANED — 已完成功能归档

> 按 `AIGENT.md` 约定：PLAN.md 中完成的大功能移入本文件，每次归档附简要总结并替换旧内容。
> 本文件只增不改已归档条目；最新的进度快照与待办仍在 `PLAN.md`。

---

## 归档批次 3：Sprint C 收官（2026-11-19）

### C1. 任务模型

**做了什么**：`Item` 补齐 `dueAt / priority(0-3) / tags / notes / completedAt / pinned`；存储结构升 v3，读取时逐条补默认值；`dueAt` 约定只到日期存当地 00:00、带时间存具体时刻；新增 `dates.ts` 承担日期分桶、逾期判断与 `input[type=date/time]` 互转。子任务与重复规则延后到 C6。

**落在哪**：`src/lib/todoStore.ts`（校验/迁移/CRUD）、`src/lib/dates.ts`。

**怎么验**：`todoStore.test.ts` + `dates.test.ts` 覆盖坏数据降级、迁移、边界日期；手工写坏 JSON 不白屏。

### C2. 视图与分组排序

**做了什么**：顶部视图 `收件箱 / 今天 / 计划 / 全部`；分组 `逾期 / 今天 / 明天 / 本周 / 以后 / 无日期`（逾期用强调色 + 文字标识）；筛选与排序（手动 / 截止时间 / 优先级 / 创建时间）；拖拽只在「全部 + 手动」启用，其他视图用上下按钮按当前视图顺序交换（关闭 D12 索引隐患）；任务行日历按钮展开行内详情（日期 / 时间 / 优先级 / 标签 / 备注）。

**落在哪**：`src/App.tsx`、`src/App.css`。

**怎么验**：三宽度无横滚；键盘完成视图切换与排序；逾期标识不只靠颜色。

### C3. 自然语言快速添加

**做了什么**：中文解析 `今天 / 明天 / 后天 / 周五 / 下周一 / 10:30 / 下午3点半 / #标签 / !!` 优先级；输入框下方展示可点击移除的 chips；解析失败按纯文本保存不阻塞输入；只识别首个日期/时间/优先级，多余写法留在正文。

**落在哪**：`src/lib/quickAdd.ts`（纯函数、零依赖、中文规则自研）。

**怎么验**：`明天 10:00 交周报 #工作 !!` 生成正确日期、标签、优先级；`quickAdd.test.ts` 50 用例。

### C4. 搜索与命令面板

**做了什么**：`Ctrl/Cmd+K` 打开面板：搜索、新建、切主题、设置、导出、清空已完成；`/` 聚焦输入，`Esc` 逐层关闭；搜索按「正文 > 标签 > 备注」加权，命中区间渲染 `<mark>`；面板支持方向键 / Home / End / Enter / Tab 循环与 IME 组词保护；选中任务不在当前视图时自动切「全部」再滚动高亮。

**落在哪**：`src/lib/search.ts`、`src/components/CommandPalette.tsx`。

**怎么验**：`search.test.ts` 加权与区间用例；键盘全流程手测。

### C5. 备忘录模式

**做了什么**：同一数据层支持 `type: "memo"`（长文本上限 1200 + 标签 + 置顶；忽略 dueAt/priority/done/completedAt）；顶部新增「备忘」视图：置顶区 + 今天/昨天/本周内/更早时间线；每日回顾（命令面板触发，抽 3 条 7 天前旧备忘，同日种子固定次日更换，可换一批）；自研轻量 Markdown 只读渲染（加粗/列表/链接，全量实体转义，链接 `rel=noopener noreferrer`，危险协议降级纯文本，`<script>` / `javascript:` 注入被中和）；快速添加与搜索兼容 memo（`Ctrl+M` 切任务/备忘模式）。

**落在哪**：`src/lib/todoStore.ts`（createMemo/isMemo/memoTimeline）、`src/lib/quickAdd.ts`（parseMemoInput）、`src/lib/review.ts`（dailyReview）、`src/lib/markdown.ts`（renderMarkdown）、`src/App.tsx` 备忘视图。

**怎么验**：markdown 24 用例含注入、review 9 用例、memoTimeline 分组用例；v3 存储结构不变，导出导入覆盖 memo；零新增依赖。

---

## 归档批次 2：Sprint B 主题系统（2026-11-18）

### B0–B5 概要

**做了什么**：B0 设置面板（齿轮入口，桌面抽屉/移动 sheet，外观/数据/关于三区，焦点圈定）；B1 主题数据结构 `ThemeDef`（tokens + scene + effects）；B2 八套主题（4 暗 3 亮 1 高对比，对比度全部测试守护：正文 ≥13.98:1、按钮 ≥5.65:1）；B3 主题选择器（8 预览卡 + 跟随系统，持久化 + 旧 key 迁移）；B4 背景按需加载（Aurora `React.lazy` 独立 chunk，visibilitychange 暂停 WebGL，reduced-motion 全降级）。

**落在哪**：`src/lib/themes.ts`、`src/components/SettingsPanel.tsx`、`src/index.css` 的 `[data-theme]` 静态 token。

**怎么验**：新增第 9 套主题只需改 themes.ts + 一段 CSS；`themes.test.ts` 自动校验对比度基线。

---

## 归档批次 1：Sprint A 稳定化（2026-11-17）

### A1–A7 概要

**做了什么**：A1 撤销删除（6s toast + 撤销恢复原位，清空二次确认）；A2 行内编辑（Enter/Esc/失焦，防重复提交）；A3 数据层升级（v2 结构 + 版本迁移 + 逐条校验 + 坏数据备份 `whim-todo:corrupt-backup`）；A4 导入导出 JSON（预览 + 二次确认 + 日期文件名）；A5 跨标签页同步（storage 事件）；A6 可访问性（aria-live 状态区、D5-D8/D11 对比度与焦点环修正）；A7 字体与元信息（系统字体栈、theme-color 跟随主题）。

**落在哪**：`src/App.tsx`、`src/lib/todoStore.ts`、`src/lib/prefs.ts`。

**怎么验**：删除 3 条连续撤销完全恢复；坏 JSON 不崩溃；仅键盘完成全流程；屏幕阅读器有播报。

---

## 附：合并记录

- `cf61028` Merge Agent2 → feat/sprint-c-core（C3/C4 阶段）
- `9a74399` Merge feat/glass-select → Agent（自定义主题化下拉，替换原生 select）
- `6d3e295` Merge fix/select-theme → Agent（下拉样式统一，后被 GlassSelect 取代）
- `c07197b` Merge feat/memo-mode → Agent（C5 备忘录模式，10 个细分提交）
- 同期 groundwork（已在 Agent 分支）：Sprint D 统计纯函数 `stats.ts` / 展示组装 `statsView.ts` / 周报导出 `weeklyExport.ts`（均零依赖、未接 UI）、`LICENSE`（MIT + react-bits vendor 例外）
