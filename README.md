# Whim Todo

极光玻璃质感的待办清单 · Vite + React + TypeScript

一个注重视觉与交互细节的开源 Todo Demo：WebGL 极光背景、玻璃拟态卡片、明暗双主题、
拖拽排序、完成彩带，以及一组流畅的微动效（react-bits + motion + gsap）。

**演示站点**：[whim-todo.netlify.app](https://whim-todo.netlify.app)
**开源仓库**：[github.com/Ls-WanMeng/whim-todo](https://github.com/Ls-WanMeng/whim-todo) · **作者**：[挽梦遗酒](https://github.com/Ls-WanMeng)

## 特性

- 🌌 WebGL 极光背景 + 玻璃拟态卡片，深浅双主题（跟随系统、本地记忆）
- ✅ 增删改查、筛选统计、进度环、完成彩带动效
- 🖱 拖拽排序（触屏可用），并提供按钮替代（WCAG 2.2 拖拽替代）
- ⌨️ `/` 聚焦输入、`Esc` 清空快捷键
- ♿ 键盘焦点环、完整 aria 标签、`prefers-reduced-motion` 全量降级

## 技术栈

Vite 8 · React 19 · TypeScript · motion · gsap · canvas-confetti · react-bits（本地 vendor）

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
| `npm run lint` | oxlint 代码检查 |

## 部署

`npm run build` 产出的 `dist/` 为纯静态文件，可直接托管到 Netlify / Vercel / GitHub Pages
（演示站点即托管于 Netlify）。

## 目录结构

```
src/
├── components/reactbits/   # react-bits 动效组件（本地 vendor，详见目录内 README）
├── hooks/                  # useReducedMotion 等
└── App.tsx / App.css       # 页面与样式
```

## Git 规范

- `develop` 为开发分支；`main` 只接受 develop 的 squash 总结提交
- 里程碑以 `vX.Y.Z` 附注标签标记

## 许可

第三方动效组件来自 [react-bits](https://github.com/DavidHDev/react-bits)
（MIT + Commons Clause，见 `src/components/reactbits/LICENSE.md`）。
