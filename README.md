# Whim Todo

极光玻璃质感的待办清单 · Vite + React + TypeScript

一个注重视觉与交互细节的开源待办清单：WebGL 极光背景、玻璃拟态卡片、明暗双主题、
拖拽排序、完成彩带，以及一组流畅的微动效（react-bits + motion + gsap）。

数据全部保存在本地浏览器，无需注册，不联网。

**演示站点**：[whim-todo.netlify.app](https://whim-todo.netlify.app)
**开源仓库**：[github.com/Ls-WanMeng/whim-todo](https://github.com/Ls-WanMeng/whim-todo) · **作者**：[挽梦遗酒](https://github.com/Ls-WanMeng)

## 特性

- 🌌 WebGL 极光背景 + 玻璃拟态卡片，8 套明暗主题（支持跟随系统、本地记忆）
- ✅ 增删改查、筛选统计、进度环、完成彩带动效
- ✏️ 双击文字或点铅笔按钮行内编辑，`Enter` 保存、`Esc` 取消
- ↩️ 删除与清除已完成都可在 6 秒内撤销，按原位置恢复
- ⚙️ 齿轮设置面板：主题选择（8 套 + 跟随系统）、动效偏好、导出 / 导入 / 清空全部数据、版本与快捷键
- 🎨 8 套主题（深海极光 / 落日沙丘 / 苔原森林 / 午夜霓虹 / 晨雾灰蓝 / 纸质手账 / 樱花奶油 / 高对比），全部通过对比度校验，切换不闪色
- 💾 导入 / 导出 JSON，导入前预览条数并二次确认
- 🔄 多标签页自动同步，本地数据带版本号、坏数据自动备份
- 🖱 拖拽排序（触屏可用），并提供按钮替代（WCAG 2.2 拖拽替代）
- ⌨️ `/` 聚焦输入、`Esc` 清空快捷键（说明收在「设置 → 关于」里，首页不占位）
- ♿ 键盘焦点环、完整 aria 标签、操作结果 aria-live 播报、`prefers-reduced-motion` 全量降级

## 技术栈

Vite 8 · React 19 · TypeScript · motion · gsap · canvas-confetti · react-bits（本地 vendor）· Vitest

## 如何编译

> 要求 Node.js ≥ 20

```bash
# 1. 克隆仓库
git clone https://github.com/Ls-WanMeng/whim-todo.git
cd whim-todo

# 2. 安装依赖
npm install

# 3. 本地开发（默认 http://localhost:5173）
npm run dev

# 4. 生产构建（类型检查 + 打包，输出 dist/）
npm run build

# 5. 本地预览生产构建
npm run preview
```

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动开发服务器（HMR） |
| `npm run build` | `tsc -b` 类型检查 + Vite 生产构建 |
| `npm run preview` | 预览生产构建产物 |
| `npm run test` | Vitest 运行数据层单元测试 |
| `npm run lint` | oxlint 代码检查 |

## 数据说明

- 数据保存在 `localStorage` 的 `whim-todo:v2`，结构为 `{ version, items }`
- 旧版的 `dsh-demo-todos` 会在首次打开时自动迁移，迁移成功写入后才清理旧键
- 读到损坏数据时，原始内容备份到 `whim-todo:corrupt-backup` 并从空白开始，避免静默丢数据
- 导出 / 导入在右上角齿轮的「设置 → 数据」里；导出文件名为 `whim-todo-YYYY-MM-DD.json`（本地日期），导入同时兼容旧版数组格式
- 动效偏好保存在 `whim-todo:motion`，可选 `system` / `reduced` / `full`
- 主题保存在 `whim-todo:theme`（主题 id 或 `auto`）与 `whim-todo:theme-pair`（跟随系统时白天/夜晚分别用哪套）

## 部署

`npm run build` 产出的 `dist/` 为纯静态文件，可直接托管到 Netlify / Vercel / GitHub Pages
（演示站点即托管于 Netlify）。

打包结果里的 `dist/index.html` 是**单文件**：JS / CSS 全部内联、脚本为普通 `<script>`（不是 ES module），
所以双击用 `file://` 打开也能正常显示，不需要起服务器。构建时用 `base: './'` + iife 输出正是为此，
改动 `vite.config.ts` 里的 `inlineSingleFile` 插件时别把这些前提破坏掉。

## 目录结构

```
src/
├── components/reactbits/   # react-bits 动效组件（本地 vendor，详见目录内 README）
├── hooks/                  # useReducedMotion 等
├── lib/                    # todoStore 纯函数数据层 + 单元测试
└── App.tsx / App.css       # 页面与样式
```

## Git 规范

- `develop` 为开发分支；`main` 只接受 develop 的 squash 总结提交
- 里程碑以 `vX.Y.Z` 附注标签标记

## 许可

第三方动效组件来自 [react-bits](https://github.com/DavidHDev/react-bits)
（MIT + Commons Clause，见 `src/components/reactbits/LICENSE.md`）。
