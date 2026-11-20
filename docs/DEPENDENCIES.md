# 依赖与模块选型

记录当前依赖、推荐候选与引入时机。新增依赖前先查这里，避免重复装同类包。

最后核对：2026-11-19（版本号取自 npm registry 当时的最新版）

## 1. 已安装

| 包 | 版本 | 用途 | 备注 |
|---|---|---|---|
| `react` / `react-dom` | 19.3.x | 视图层 | — |
| `motion` | 14.14 | 列表增删、Reorder、拖拽 | 已用于 `App.tsx`、`ThemeScene` |
| `gsap` | 3.15 | react-bits 组件内部动画（BlurText 等） | 非直接调用 |
| `canvas-confetti` | 1.9 | 完成全部任务时的彩带 | 颜色取自当前主题 `effects.confetti` |
| `vite` | 8.3 | 构建 | 已支持 `React.lazy` 拆包（Aurora 独立 chunk） |
| `typescript` | 7.0 | 类型检查 | `tsc -b` |
| `vitest` | 5.1 | 单元测试 | 纯函数为主，当前 210 个用例（C5 结束） |
| `oxlint` | 1.9x | 静态检查 | 仅剩 react-bits vendor 的既有 warning |

原生能力已覆盖、**不需要**额外包的场景：

- 日期格式化与相对时间 → `Intl.DateTimeFormat` / `Intl.RelativeTimeFormat`
- 唯一 ID → `crypto.randomUUID()`（`todoStore.ts` 已有降级实现）
- 深浅色偏好 → `window.matchMedia`
- 深浅拷贝 → `structuredClone`
- 失焦 / 键盘 / 滚动锁 → 原生事件与 `document.body.style.overflow`

## 2. 推荐候选（按引入时机排序）

### 2.1 Sprint C 之前可能用到

| 包 | 体积 | 建议 | 时机 |
|---|---|---|---|
| `@testing-library/react` + `@testing-library/user-event` + `happy-dom` | 约 330 KB + 430 KB + 9 MB（仅开发依赖） | 想给设置面板、行内编辑、撤销写 DOM 级测试时再装 | C1 任务模型改完后，UI 复杂度上来时 |
| `tinykeys` | 76 KB | 快捷键变多（`Ctrl+K`、`G` 加前缀）后可替换手写监听 | C4 命令面板 |
| `fuse.js` | 407 KB | 只在搜索需要容错（拼错也能搜到）时才用；简单包含匹配手写更快 | C4，先不装 |

**判断标准**：如果某个交互只有 3~5 行原生代码，就不引入依赖。

### 2.2 明确推荐「先不装」

| 包 | 为什么不装 |
|---|---|
| `zod`（6 MB）/ `valibot`（1.8 MB） | 当前校验逻辑已在 `todoStore.ts` 手写且带 26 个测试，够用。真要上 schema，选 `valibot`（可摇树、体积小） |
| `dayjs`（666 KB）/ `date-fns`（10 MB） | 只需要格式化与「今天/明天/本周」计算，`Intl` + 几十行工具函数足够 |
| `chrono-node`（3 MB） | `PLAN.md` C3 明确「中文规则自研，先不接大模型」，它主要支持英文表达，中文识别不占优 |
| `zustand`（109 KB） | 单页面状态用 `useState` 已够；引状态库反而增加心智负担 |
| `cmdk`（80 KB） | 命令面板自己写 `dialog` + 键盘导航即可，且要复用现有设置面板的焦点管理 |
| `clsx` / `tailwind-merge` | 项目用原生 CSS 变量与 BEM 风格类名，没有冲突合并需求 |
| `marked` + `dompurify` | 备忘录轻量 Markdown 手写正则更可控，也避免 XSS 面。**C5 已按此落地**：`src/lib/markdown.ts` 自研，24 个测试覆盖转义与协议白名单，未引入任何包 |
| `idb-keyval`（55 KB） | localStorage 目前够用；数据量真到几 MB 再换 IndexedDB |
| `vite-plugin-pwa` | A8 已明确暂缓；将来要 PWA 时再装（要求 Node ≥ 20.19）。**2026-11-20 复核**：与「单文件双击打开」架构冲突——PWA 需独立 `manifest.webmanifest` / `sw.js` / 图标产物，且 Service Worker 无法在 `file://` 下注册；当前 `vite.config.ts` 的 `inlineSingleFile` 插件把 JS/CSS 全部内联进 `index.html`。若要做「可安装 + 离线」，需先决定是否放弃 file:// 双击打开，届时再评估 PWA 作为增强模式单独构建 |
| `@axe-core/react` | 开发期无障碍审计可用，但会拖慢 dev 启动；优先用浏览器 Lighthouse |

### 2.3 视觉层

- 继续用本地 vendor 的 react-bits（`src/components/reactbits/`），不引 UI 组件库（Radix / shadcn / AntD 都不必要）
- WebGL 背景必须 `React.lazy`，且每套主题只配一个场景
- 新动效组件一律遵守：`prefers-reduced-motion` 下静态化、移动端注意安全区、不叠加 `backdrop-filter`

## 3. 新增依赖的验收清单

1. 体积：gzip 后是否可接受？能否 `lazy` 或按需 `import()`？
2. 替代：原生 API 或现有依赖能否覆盖？
3. 许可：是否与现有 MIT / 私有项目兼容？（注意 `@axe-core/*` 是 MPL-2.0）
4. 维护：最近一年是否有发布？issues 是否活跃？
5. 记录：更新本文件表格，并在提交信息说明理由

## 4. 本轮（C5 备忘录模式）依赖结论

**本轮零新增：没有添加任何 runtime / dev 依赖，`package.json` 未发生变化。**

| 需求 | 实现方式 | 位置 |
|---|---|---|
| 轻量 Markdown（加粗 / 列表 / 链接） | 自研 30 行左右正则渲染，先全量转义再放行安全协议 | `src/lib/markdown.ts` |
| 每日回顾随机取样 | 自研 `mulberry32` 确定性随机，种子按日期生成，同日固定、次日更换 | `src/lib/review.ts` |
| 备忘时间线分组 | 复用既有 `dates.ts` 的 `startOfDay / addDays / startOfWeek` | `src/lib/todoStore.ts` |
| 备忘输入解析 | 复用 `quickAdd.ts` 的标签扫描逻辑，只认 `#标签` | `src/lib/quickAdd.ts` |

体积影响：0 KB（无新包）。测试覆盖：`markdown.test.ts`（24）、`review.test.ts`（9）、`todoStore.test.ts`（68）、`quickAdd.test.ts`（50）、`search.test.ts`（19），合计 210 个用例。