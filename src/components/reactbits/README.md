# react-bits 组件（本地 vendor）

来源：https://github.com/DavidHDev/react-bits（MIT + Commons Clause，见同目录 LICENSE.md）

本目录收录 ts-default（TypeScript + CSS）变体组件，仅做原样引入用于页面动效：

| 组件 | 用途 |
|------|------|
| Aurora | WebGL 极光背景（替换早期 CSS 极光层） |
| BlurText | 标题逐字模糊入场（motion） |
| AnimatedContent | 卡片整体入场（gsap ScrollTrigger，mount 触发） |
| CountUp | 统计数字滚动（motion） |
| SpotlightCard | 卡片鼠标追随光斑 + 边缘流光（替代原玻璃卡片外壳） |
| ShinyText | 进度文案流光划过（CSS mask，尊重 reduced-motion） |

更新方式：从上游仓库 src/ts-default/... 复制对应组件文件覆盖即可。
