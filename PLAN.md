# Whim Todo 演进计划

> 基于 2026-11-17 对仓库代码、`design-system/`、react-bits vendor 目录与同类产品的评审整理。
> 目标：把「视觉演示型 Demo」推进到「敢日常使用的轻量备忘录 + 待办」。
> 分支约定见文末，遵循仓库 `AIGENT.md`：临时分支 → `develop` →（经确认）squash 到 `main`。

---

## 0. 定位与成功标准

**定位建议：视觉优先的个人备忘录 + 待办（local-first，无需账号）。**

不做「又一个 Todoist」：核心差异是「打开就想记一笔」的手感，以及「记得住、找得回」的回顾能力。

| 阶段 | 成功标准 |
|---|---|
| v1.1 稳定 | 连续使用一周不丢数据；误删可恢复；换设备能导出/导入 |
| v1.2 主题 | 8 套主题可切换且全部通过对比度检查；首屏不闪色 |
| v1.3 日用 | 能用「明天 10 点交周报 #工作 !!」一句话建任务；今天视图可用 |
| v1.4 记忆 | 备忘录时间线 + 每日回顾 + 周报导出可用 |

---

## 1. 现状结论

**已经做得好的：**

- 玻璃卡片 + WebGL 极光 + 明暗主题，视觉完成度高。
- 拖拽排序提供了按钮替代方案，符合 WCAG 2.2 拖拽替代要求。
- `prefers-reduced-motion` 做了全量降级。
- token 已收口在 `src/index.css`，主题扩容有基础。

**主要短板：**

- 数据只有 localStorage，无版本、无校验、无导出、无撤销。
- 不能编辑已有条目，没有时间/优先级/标签维度。
- 主题相关颜色散落在 `App.tsx` 三处，新增主题成本被放大。

---

## 2. 体检清单（先修）

> 编号用于后续提交信息与验收，例如 `fix(D3): 撤销删除`。

| ID | 严重度 | 问题 | 位置 | 处理方案 | 验收 |
|---|---|---|---|---|---|
| D1 | 高 | 删除、清空已完成不可撤销 | `App.tsx` `remove` / `clearDone` | 删除后 5s toast + 撤销；清空用长按/二次确认 | 误删可一键恢复 |
| D2 | 高 | 数据结构无版本、无校验 | `loadTodos` | 存 `{ version, items }`，逐条校验；坏数据降级为空并提示 | 手工写入坏 JSON 不白屏 |
| D3 | 高 | `localStorage.setItem` 未捕获异常 | `App.tsx:211` | try/catch + 配额/隐私模式提示 | 隐私模式可正常打开 |
| D4 | 中高 | 多标签页互相覆盖 | 无 `storage` 监听 | `storage` 事件同步；冲突时以 `updatedAt` 较新者为准 | 两标签页增删互相同步 |
| D5 | 中高 | 浅色辅助文字对比度不足 | `index.css` `--color-subtle:#64748b` | 改为 `#5b6b80`（4.63:1） | 浅色下 ≥4.5:1 |
| D6 | 中 | 浅色主按钮对比度擦线 | `#0d9488` + `#04211f` = 4.51:1 | 主色改 `#0f766e` + 白字（5.47:1） | 按钮文字 ≥4.5:1 |
| D7 | 中 | 输入框焦点只剩边框变色 | `App.css:133-136` | 增加 `box-shadow: 0 0 0 3px color-mix(...)` 焦点环 | 键盘可见焦点 |
| D8 | 中 | 增删/完成无读屏播报 | 全局 | `aria-live="polite"` 状态区；删除后焦点归位 | VoiceOver/NVDA 可听到变化 |
| D9 | 中 | 主题色散落三处 | `App.tsx:37/315/491` | 收进 `ThemeDef.effects/scene` | 新增主题只改主题文件 |
| D10 | 低中 | 声明 Inter 但未加载 | `index.css:23` / `index.html` | 自托管 subset，或删除声明用系统字体 | 不出现“假字体声明” |
| D11 | 低 | 英文单词被硬断 | `App.css:377` `word-break:break-all` | 改 `overflow-wrap:anywhere` | 英文不按字母断行 |
| D12 | 低 | 筛选视图重排索引隐患 | `move(i,delta)` 用全量下标 | 改为按 id + `order` 字段移动；当前保持筛选下禁用拖拽 | 筛选态不出现错位 |
| D13 | 低 | `theme-color` 固定不随主题 | `index.html:7` | 切换主题时更新 meta | 移动端浏览器栏颜色跟随 |
| D14 | 文档 | `design-system/MASTER.md` 与实际 UI 不符 | `design-system/todo-demo/` | 主题定型后重新生成并提交 | 文档与实现一致 |
| D15 | 文档 | 根目录缺少 `LICENSE` | 仓库根 | 补 MIT，注明 vendor 目录适用 Commons Clause | GitHub 识别许可证 |

---

## 3. 路线图总览

| Sprint | 目标 | 预计 | 依赖 | 出口标准 |
|---|---|---|---|---|
| **A. 稳** | 数据安全 + 可访问性 + PWA | 1–2 天 | 无 | D1–D11、D13 关闭；lint/build 通过 |
| **B. 皮** | 主题系统 8 套 + 选择器 | 1–2 天 | A（D9） | 8 套主题通过对比度与首屏检查 |
| **C. 用** | 时间/优先级/标签 + 今天视图 + 快速添加 + 搜索 | 3–5 天 | B | 一句话建任务可用；Today 视图可用 |
| **D. 记** | 备忘录模式 + 回顾 + 统计 | 3–5 天 | C | 可记录、可回顾、可导出周报 |
| 可选池 | 番茄钟 / 分享 / 同步 / 习惯 | 按需 | C/D | 单项独立验收 |

---

## 4. Sprint A：稳定化

### A1. 撤销删除与危险操作确认

- [x] 删除条目后展示 toast：「已删除 · 撤销」，6 秒后消失（比计划的 5 秒多留 1 秒）。
- [x] 撤销恢复原位置与 `order`（多选清除也按原顺序恢复）。
- [x] 「清除已完成」改为二次点击确认（按钮变成「确认清除 N 项」，4 秒未确认自动收回）。
- [x] 删除/撤销后焦点回到输入框，键盘可完成全流程。

**验收：** 删除 3 条后连续撤销，顺序与内容完全恢复；键盘可完成全流程。

### A2. 行内编辑

- [x] 双击文字或点击编辑按钮进入编辑态。
- [x] `Enter` 保存，`Esc` 取消，失焦保存；空值还原。
- [x] 编辑态保留 `aria-label` 与焦点环，并防止 Enter + blur 重复提交。

**验收：** 编辑中按 `Esc` 不改变数据；保存后刷新仍在。

### A3. 数据层升级

- [x] 存储结构改为 `{ version: 2, items: Item[] }`。
- [ ] `Item` 增加 `createdAt / updatedAt / order`；`completedAt` 暂未落地（当前 UI 未使用，等 C 阶段统计再补）。
- [x] `id` 改用 `crypto.randomUUID()`，不支持时退回时间戳 + 随机串。
- [x] 迁移旧 key `dsh-demo-todos`；迁移后先落盘新结构、成功写入才清理旧 key。
- [x] 读取时逐条校验，非法条目丢弃并在提示条中报告数量；解析失败时原始内容备份到 `whim-todo:corrupt-backup`。

**验收：** 旧数据可迁移；手工写入 `[null, {"text":1}]` 不崩溃。

### A4. 导入 / 导出

- [x] 导出 JSON（含 `app`、`version`、`exportedAt`）。
- [x] 导入先解析并预览条数与无效项，确认后覆盖写入（合并模式留到后续）。
- [x] 导出文件名带日期：`whim-todo-YYYY-MM-DD.json`。

**验收：** 导出后清空浏览器数据，导入可完整恢复。

### A5. 跨标签页同步

- [x] 监听 `storage` 事件，外部变更时重新读取并刷新状态，同时 aria-live 播报。
- [ ] 以 `updatedAt` 较新者为准的逐条冲突合并未实现；当前采用「整体以最新写入为准」，足以覆盖两个标签页顺序操作的常见场景。

**验收：** 标签页 A 添加、标签页 B 1 秒内出现；反向同样成立。

### A6. 可访问性与视觉修正

- [x] D5/D6/D7/D8/D11 全部关闭。
- [x] 增加 `aria-live` 状态区：新增、完成、删除、撤销、编辑、导入结果。
- [x] 键盘 Tab 顺序与视觉顺序一致（工具栏、条目操作按钮均在 DOM 顺序中）。
- [x] `prefers-reduced-motion` 下不播放 toast / 列表动画。

**验收：** 仅用键盘完成「新增 → 完成 → 删除 → 撤销」；屏幕阅读器有播报。

### A7. 字体与元信息

- [x] 字体策略选「删除声明、改用系统字体栈」，去掉未加载的 Inter。
- [x] `theme-color` 跟随主题；补 `description`、`og:title`、`og:description`（`og:image` 与 `LICENSE` 待补）。
- [ ] 根目录补 `LICENSE`（MIT，注明 vendor 例外）—— 留到发布 v1.1.0 前处理。

### A8. PWA 与离线（可拆到 A 之后）

- [ ] 接入 `vite-plugin-pwa`，`registerType: 'autoUpdate'`。
- [ ] 补 manifest、192/512 图标、`apple-touch-icon`、启动色。
- [ ] 离线可打开，显示「离线模式」提示。
- [ ] 文档写明 iOS Web Push 限制，不承诺到点必响。

**验收：** 断网刷新仍可使用；Lighthouse PWA 可安装检查通过。

---

## 5. Sprint B：主题系统

### B1. 数据结构

新建 `src/theme/themes.ts`：

```ts
export type ThemeDef = {
  id: string;
  label: string;
  mode: "dark" | "light";
  tokens: Record<string, string>;
  scene: {
    kind: "aurora" | "silk" | "grainient" | "none";
    colors: [string, string, string];
    opacity: number;
  };
  effects: {
    confetti: string[];
    spotlight: string;
  };
};
```

- [ ] CSS 用 `[data-theme="<id>"]` 静态声明 token，避免首屏闪色。
- [ ] `index.html` 增加内联脚本，绘制前读取主题并设置 `data-theme`。
- [ ] `App.tsx` 的 Aurora `colorStops`、`SpotlightCard.spotlightColor`、`CONFETTI_COLORS` 改为读取当前主题。
- [ ] 切换主题时同步 `meta[name=theme-color]` 与 `color-scheme`。

### B2. 八套主题

| 主题 | 模式 | 底色 | 主色 | 强调 | 场景 |
|---|---|---|---|---|---|
| 深海极光（默认） | 暗 | `#0b1120` | `#2dd4bf` | `#fb923c` | Aurora 青/靛/橙 |
| 落日沙丘 | 暗 | `#170f12` | `#fb7185` | `#fbbf24` | Aurora 珊瑚/琥珀/紫 |
| 苔原森林 | 暗 | `#0b1310` | `#4ade80` | `#facc15` | Aurora 绿/青/黄绿 |
| 午夜霓虹 | 暗 | `#08060f` | `#a78bfa` | `#22d3ee` | DarkVeil / Prism 紫/青/粉 |
| 晨雾灰蓝 | 亮 | `#eef2f7` | `#2563eb` | `#c2410c` | Aurora 低透明度蓝/紫/粉 |
| 纸质手账 | 亮 | `#f7f1e3` | `#92400e` | `#4f46e5` | 无 WebGL，Grainient 微噪点 + 弱模糊 + 衬线标题 |
| 樱花奶油 | 亮 | `#fff5f7` | `#be185d` | `#7c3aed` | Grainient / SoftAurora 粉/紫/奶黄 |
| 高对比 | 亮/暗 | `#000000` | `#ffe066` | `#66d9e8` | 无动画、无模糊、2px 边框、3px 焦点环 |

对比度基线（已实测）：

- 正文/底色最低 13.98:1。
- 按钮文字/按钮底色最低 5.17:1。
- 高对比主题同时响应 `prefers-contrast: more` 与 `forced-colors`。

### B3. 主题选择器

- [ ] 8 张迷你预览卡（底色 + 三个色点 + 明暗角标）。
- [ ] `role="radiogroup"`，支持方向键切换。
- [ ] 「跟随系统」：允许分别指定白天/夜晚主题，监听 `matchMedia` 变化。
- [ ] 持久化主题 id 与 auto 配置；迁移旧 `dsh-demo-theme`。

### B4. 背景与性能

- [ ] 每套主题只配一个背景；非默认场景按需 `import()`。
- [ ] `visibilitychange` 时暂停 WebGL；移动端降低 `backdrop-filter` 模糊值。
- [ ] `reduced-motion` 下关闭背景动画与主题切换过渡。

### B5. 文档同步

- [ ] 主题定型后重新生成 `design-system/todo-demo/MASTER.md`（`--design-system --persist --force`）。
- [ ] 在 README 增加主题截图/说明。

**Sprint B 验收：** 8 套主题切换无闪色；每套主题下正文、按钮、焦点环、禁用态均达标；新增第 9 套主题只需改 `themes.ts` + 一段 CSS。

---

## 6. Sprint C：日用能力

### C1. 任务模型

```ts
type Item = {
  id: string;
  type: "task" | "memo";
  text: string;
  notes?: string;
  done: boolean;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  dueAt?: number;
  priority: 0 | 1 | 2 | 3;
  tags: string[];
  order: number;
  pinned?: boolean;
};
```

- [ ] 补齐 `dueAt / priority / tags / notes`。
- [ ] 子任务、重复规则延后到 C6。

### C2. 视图与分组

- [ ] 顶部视图：`收件箱 / 今天 / 计划 / 全部`。
- [ ] 分组：`逾期 / 今天 / 明天 / 本周 / 以后 / 无日期`。
- [ ] 逾期用强调色 + 文字标识，不只靠颜色。
- [ ] 筛选与排序（手动 / 截止时间 / 优先级 / 创建时间）。

### C3. 自然语言快速添加

- [ ] 支持：`明天`、`周五`、`下周一`、`10:30`、`每晚`、`#标签`、`!!` 优先级。
- [ ] 输入框下方展示可点击修正的 chips。
- [ ] 解析失败时按纯文本保存，不阻塞输入。
- [ ] 中文规则自研，先不接大模型。

**验收：** `明天 10:00 交周报 #工作 !!` 生成正确日期、标签、优先级。

### C4. 搜索与命令面板

- [ ] `Ctrl/Cmd + K` 打开：搜索、新建、切主题、导出、清空。
- [ ] `/` 仍聚焦输入；`Esc` 逐层关闭。
- [ ] 搜索结果高亮关键词。

### C5. 备忘录模式

- [ ] 同一数据层支持 `type: "memo"`：长文本 + 标签 + 时间线 + 置顶。
- [ ] 按日期分组的时间线视图。
- [ ] 每日回顾：随机/按时间抽 3 条旧记录。
- [ ] 轻量 Markdown（加粗、列表、链接），不做完整编辑器。

### C6. 模板与重复（可选）

- [ ] 任务模板（如「每周复盘」）。
- [ ] 重复规则：每天 / 每周 / 工作日。
- [ ] 完成重复任务后生成下一次，保留历史。

---

## 7. Sprint D：统计与回顾

- [ ] 周热力图（7 × 12 周）。
- [ ] 连续完成天数（streak）。
- [ ] 按标签完成率。
- [ ] 一键导出周报 Markdown。
- [ ] 统计只读当前数据，不引入额外埋点。

**验收：** 一周真实使用后，周报能总结完成数、逾期数、主要标签。

---

## 8. 可选池（不排期，按需取用）

| 功能 | 价值 | 成本 | 触发条件 |
|---|---|---|---|
| 番茄钟 / 专注模式 | 中 | M | 有用户明确要“专注” |
| 分享清单快照图片 | 中 | S | 需要传播/展示 |
| 本地文件同步（File System Access） | 中 | M | 用户拒绝云端但要多设备 |
| WebDAV 同步 | 中 | M | 自托管用户需求 |
| 习惯打卡（极简每日一次） | 低中 | M | 明确要“养成习惯” |
| 云同步 / 账号 | 高 | L | 有后端预算与隐私方案 |
| 协作 / 团队空间 | 低 | XL | 不建议在当前定位下做 |
| AI 周报 / 自然语言 | 中 | M | 有代理层，且可关闭 |

---

## 9. react-bits 选型

| 场景 | 组件 | 说明 | 注意 |
|---|---|---|---|
| 完成勾选 | `SpringCheck`（Micro） | 弹簧勾选 + 划线 | 保留原生 checkbox 语义与 `aria` |
| 移动端操作 | `SwipeRow`（Micro） | 左滑完成、右滑删除 | 必须提供按钮替代 |
| 撤销删除 | `SwipeToast`（Micro） | 撤销条，可滑动关闭 | reduced-motion 下静态展示 |
| 危险操作 | `HoldButton`（Micro） | 长按确认清除 | 键盘需等价操作 |
| 主题预览 | `CardSwap`（Components） | 主题卡翻转/轮播 | 预览卡需可键盘选择 |
| 筛选导航 | `PillNav` / `GooeyNav` | 替换现有 segmented 的可选项 | 现有实现已达标，非必需 |
| 点击反馈 | `ClickSpark`（Animations） | 添加按钮轻量火花 | 只用于主操作 |
| 主按钮 | `StarBorder` / `BorderGlow` | 边缘流光 | 避免与 SpotlightCard 叠加过重 |
| 列表增删 | `AnimatedList`（Components） | 列表动效 | 与现有 Reorder 二选一 |
| 底部快捷栏 | `Dock`（Components） | 新建/搜索/专注/主题 | 移动端注意安全区 |
| 备忘录卡片流 | `Masonry` / `ChromaGrid` | memo 瀑布流/标签墙 | 大量卡片时注意虚拟化 |
| 清单分组 | `Folder` | 工作/生活/灵感 | 与标签体系避免重复 |
| 优先级选择 | `JellyRadio` / `OptionWheel` | P0–P3 选择 | 移动端触控目标 ≥44px |
| 快速记录 | `ThoughtLine` / `PromptBar` | memo 输入条 | 注意中文输入法组合态 |
| 趣味删除 | `PaperCrumple` / `Shredder` / `TearTicket` | 删除动效 | 仅桌面、默认关闭 |
| 主题背景 | `SoftAurora` / `Silk` / `Grainient` / `DotGrid` / `DarkVeil` | 主题场景 | 每套只配一个，lazy load |

**约束：** 每类最多选 1 个；新增依赖需在 PR 里说明包体与 GPU 成本。

---

## 10. 竞品借鉴

| 产品 | 借什么 | 不借什么 |
|---|---|---|
| Memos | 时间线、标签、搜索、数据自持 | 自托管部署复杂度 |
| flomo | 快速记录、每日回顾、低压力 | 纯卡片流、无完成概念 |
| 滴答清单 | 自然语言日期、日历、番茄钟、四象限 | 五个模块全塞进首页 |
| Things 3 | Today / Upcoming / Areas / 周回顾 | 强依赖 Apple 生态 |
| Apple Reminders | 智能列表、模板 | 位置提醒需原生能力 |
| Superlist / Amie | 键盘优先、完成手感、克制动效 | 协作/团队功能 |
| Obsidian Tasks / Logseq | 本地优先、Markdown 导出 | 双链/图谱学习成本 |
| Vikunja | 列表/看板/甘特多视图 | 过早做甘特 |

---

## 11. 明确不做（当前阶段）

- 账号体系、云同步、协作空间
- AI 聊天式助手
- 同时上线日历 / 看板 / 四象限 / 习惯 / 番茄钟五种视图
- 未做对比度校验的主题批量上线
- 默认开启碎纸/撕纸类删除动效
- 用 emoji 充当结构图标

---

## 12. 每个 Sprint 的必过门禁

- [ ] `npm run lint` 通过。
- [ ] `npm run build` 通过（含 `tsc -b`）。
- [ ] 375px / 768px / 1440px 三种宽度无横向滚动。
- [ ] 键盘完成核心流程，焦点可见且不落在遮罩后。
- [ ] 开启 `prefers-reduced-motion` 后无必要动画。
- [ ] 浅色/深色分别检查对比度（正文 ≥4.5:1，非文本 ≥3:1）。
- [ ] 模拟 localStorage 损坏、配额满、隐私模式三种异常。
- [ ] 多标签页同步场景手测一次。
- [ ] 新依赖在 PR 中说明体积与许可。

---

## 13. 分支与提交

遵循 `AIGENT.md`：

1. 从 `develop` 建临时分支，例如 `feat/theme-system`。
2. 小步提交，提交信息带任务编号：`fix(D3): 捕获 localStorage 写入异常`。
3. 阶段完成后 squash/汇总提交到 `develop`。
4. `develop` 合并到 `main` 前先征得同意。
5. 里程碑打 `vX.Y.Z` 附注标签。

建议里程碑：

| 版本 | 内容 |
|---|---|
| v1.1.0 | Sprint A 稳定化 |
| v1.2.0 | Sprint B 主题系统 |
| v1.3.0 | Sprint C 日用能力 |
| v1.4.0 | Sprint D 备忘录与回顾 |

---

## 14. 待决策

1. **定位取舍**：先做「待办优先」还是「备忘录优先」？当前计划按「待办为骨架，备忘录为差异」推进。
2. **主题默认**：默认深海极光，还是跟随系统（白天晨雾 / 夜晚极光）？
3. **同步策略**：v1.3 前只做导入导出，还是直接上 WebDAV？
4. **字体**：自托管 Inter subset，还是完全使用系统字体栈？

---

## 附：评审依据

- 代码：`src/App.tsx`、`src/App.css`、`src/index.css`、`index.html`、`vite.config.ts`。
- 设计系统：`design-system/todo-demo/MASTER.md`（当前与实际 UI 不一致，待 B5 更新）。
- 组件库：react-bits 上游组件清单（Text Animations 33 / Animations 38 / Components 48 / Micro 34 / Backgrounds 63）。
- 同类产品：Memos、flomo、滴答清单、Things 3、Apple Reminders、Superlist、Obsidian Tasks、Vikunja。
- 对比度：按 WCAG 相对亮度公式实测，数值见 D5/D6 与 B2。
