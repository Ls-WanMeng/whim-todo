# Design System Master File

> **LOGIC:** When building a specific page, first check `design-system/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** Whim Todo
**Generated:** 2026-11-20（手工重写，与 `src/index.css` / `src/lib/themes.ts` 实际实现对齐）
**Category:** Productivity Tool（local-first 待办 + 备忘录）

---

## Global Rules

### 设计定位

视觉优先的「个人备忘录 + 待办」，打开就想记一笔。核心差异：
- **玻璃拟态 + WebGL 极光**的暗色底，配几套亮色主题做日间场景。
- **8 套主题**切换不闪色（首屏由 `index.html` 内联脚本先定 `data-theme`）。
- 数据本地优先（localStorage），不联网、无账号。

### Color Palette（主题 token 结构）

> 每套主题在 `src/index.css` 用 `[data-theme="<id>"]` 静态声明一套变量，
> 组件内**只引用 CSS 变量，禁止写裸 hex**。变量定义在 `:root`（默认深海极光）。

| Role | CSS Variable | 说明 |
|------|--------------|------|
| Primary | `--color-primary` | 主色（按钮 / 链接 / 高亮） |
| Primary Strong | `--color-primary-strong` | 主色 hover / 强调 |
| On Primary | `--color-on-primary` | 主色上的文字 |
| Accent | `--color-accent` | 强调 / 彩带 |
| Background | `--color-background` | 页面底色 |
| Foreground | `--color-foreground` | 正文 |
| Card | `--color-card` | 卡片底色（半透明玻璃） |
| Card Foreground | `--color-card-foreground` | 卡片正文 |
| Muted | `--color-muted` | 弱背景（分隔 / 标签底） |
| Muted Foreground | `--color-muted-foreground` | 次级正文 |
| Subtle | `--color-subtle` | 辅助文字（时间戳 / 占位） |
| Border | `--color-border` | 边框（半透明） |
| Destructive | `--color-destructive` | 危险操作 / 逾期 |
| Ring | `--color-ring` | 焦点环描边色 |
| Focus Ring | `--color-focus-ring` | 焦点环外发光 |
| Shadow | `--color-shadow` | 卡片投影 |

**8 套主题**（定义在 `src/lib/themes.ts`，`tokens` + `scene` + `effects` 三段）：

| id | label | 模式 | 主色 | 背景场景 |
|----|-------|------|------|----------|
| `abyss` | 深海极光（默认） | dark | `#2dd4bf` | aurora（WebGL） |
| `dune` | 落日沙丘 | dark | `#fb7185` | aurora |
| `tundra` | 苔原森林 | dark | `#4ade80` | aurora |
| `neon` | 午夜霓虹 | dark | `#a78bfa` | aurora |
| `mist` | 晨雾灰蓝 | light | `#1d4ed8` | aurora（低透明） |
| `paper` | 纸质手账 | light | `#92400e` | grainient（纯 CSS 噪点） |
| `sakura` | 樱花奶油 | light | `#be185d` | grainient |
| `contrast` | 高对比 | dark | `#ffe066` | none（无背景、2px 边框） |

**对比度基线**（`src/lib/themes.test.ts` 每次跑守护）：
正文 / 底色 ≥ 13.98:1；辅助文字 / 底色 ≥ 5.45:1；按钮文字 / 按钮底色 ≥ 5.65:1；主色 / 底色与强调色 / 底色 ≥ 4.5:1。

### Typography

- **字体：系统字体栈**（不加载网络字体，去掉早期未加载的 Inter 声明）。
- `--font-sans`: `system-ui, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif`
- `--font-serif`: `"Songti SC", "Noto Serif SC", "Source Han Serif SC", Georgia, serif`（纸质手账主题标题用衬线）
- **Mood:** 玻璃拟态、极光、暗色高级感、克制、柔和、中文友好。

### Spacing Variables

| Token | Value | Usage |
|-------|-------|-------|
| `--space-1` | `4px` | 紧凑间隙 |
| `--space-2` | `8px` | 图标间隙、内联间距 |
| `--space-3` | `12px` | 小间距 |
| `--space-4` | `16px` | 标准内边距 |
| `--space-5` | `20px` | 中段内边距 |
| `--space-6` | `24px` | 区块内边距 |
| `--space-8` | `32px` | 大间距 |

### Radius & Motion

| Token | Value |
|-------|-------|
| `--radius-sm` | `8px` |
| `--radius-md` | `12px` |
| `--radius-lg` | `20px` |
| `--transition` | `160ms ease` |
| `--transition-theme` | `240ms ease`（主题切换） |
| `--glass-blur` | `12px`（`backdrop-filter`） |

---

## Component Specs

### Buttons

```css
/* 主按钮：主色底 + on-primary 文字 */
.btn-primary {
  background: var(--color-primary);
  color: var(--color-on-primary);
  min-height: 44px;          /* 触控目标 ≥ 44px */
  padding: 0 var(--space-5);
  border-radius: var(--radius-sm);
  font-weight: 600;
  transition: background var(--transition), transform var(--transition);
}
.btn-primary:hover:not(:disabled) { background: var(--color-primary-strong); }
.btn-primary:active:not(:disabled) { transform: scale(0.97); }
.btn-primary:disabled { opacity: 0.45; cursor: not-allowed; }
```

### Cards（玻璃拟态）

```css
.card {
  background: var(--color-card);        /* 半透明玻璃 */
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  backdrop-filter: blur(var(--glass-blur));
}
```

### Inputs（焦点环）

```css
.input-row input:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--color-focus-ring);   /* 键盘可见焦点环 */
}
```

### 焦点（全局）

```css
:focus-visible {
  outline: 2px solid var(--color-ring);
  outline-offset: 2px;
}
```

---

## Style Guidelines

**Style:** Glassmorphism + 极光背景（暗色为主，亮色主题为日间场景）

**Keywords:** 玻璃拟态、极光、柔和、克制、local-first、无障碍、键盘优先

**Key Effects:**
- WebGL 极光背景（`ThemeScene`）走 `React.lazy` 独立 chunk，`visibilitychange` 暂停，`reduced-motion` 关闭。
- 每套主题只配一个背景场景（aurora / grainient / none）。
- 过渡 150–240ms，`prefers-reduced-motion` 全量降级（toast / 列表 / 主题切换动画全部关闭）。

### Page Pattern

**Pattern:** 单页应用（SPA），顶部视图栏切换「收件箱 / 今天 / 计划 / 全部 / 备忘 / 统计」。

---

## Anti-Patterns (Do NOT Use)

- ❌ **裸 hex / 硬编码色值** — 一律用 `--color-*` 变量（主题切换才能生效）
- ❌ **Emojis as icons** — 用 SVG 图标，不用 emoji 充当结构图标
- ❌ **完整 UI 组件库** — 用本地 vendor 的 react-bits + 手写 CSS，不引 Radix / shadcn / AntD
- ❌ **低对比度** — 正文 / 按钮 / 焦点环 / 禁用态每套主题都要达标（有测试守护）
- ❌ **不可见焦点** — 键盘焦点环必须可见（`:focus-visible`）
- ❌ **新增运行时依赖** — 优先原生 API；确需引入先查 `docs/DEPENDENCIES.md` 并说明体积 / 懒加载 / 替代方案
- ❌ **默认开启碎纸 / 撕纸类删除动效** — 趣味动效仅桌面、默认关闭
- ❌ **`file://` 兼容性破坏** — 构建靠 `inlineSingleFile` 插件产出单文件双击可开，别改坏 `base:'./'` + iife 前提

---

## Pre-Delivery Checklist

Before delivering any UI code, verify:

- [ ] 所有颜色走 `--color-*` 变量，无裸 hex
- [ ] 8 套主题下正文、按钮、焦点环、禁用态对比度达标（跑 `npm run test`）
- [ ] `:focus-visible` 焦点环可见，键盘 Tab 顺序与视觉顺序一致
- [ ] `prefers-reduced-motion` 下无新增动画
- [ ] 响应式：375px / 768px / 1440px 无横向滚动
- [ ] 触控目标 ≥ 44px
- [ ] `aria-live` 播报增删改、导入导出结果
- [ ] 英文单词用 `overflow-wrap:anywhere`，不按字母硬断
- [ ] 零新增依赖（确需引入先查 `docs/DEPENDENCIES.md`）
- [ ] `npm run lint`（0 error）+ `npm run build`（含 tsc）+ `npm run test` 全绿
