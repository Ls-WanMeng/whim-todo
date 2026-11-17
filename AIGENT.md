缓存文件等垃圾产出一定要写到.gitignore文件



新建develop本地分支，用来日常维护



改项目的时候建一个临时分支，可以在分支上多做几次，感觉差不多了merge提交一次develop

- 合并到 develop 用普通 merge（保留分支内的细分提交），不要对临时分支再 squash
- 只有 develop → main 才需要 squash 汇总提交，且必须先经过我同意

develop git merge squash 到main先经过我同意



往develop main分支放的时候都要写好commit，比如commit量：工具类维护小分支较多积累几条有好进展了总结一下发到develop累积到功能差不多完工了，总结一下发到main分支

git版本管理工具skill我给你放到了同级目录了

## 依赖与模块约定

引入新依赖前先看 `docs/DEPENDENCIES.md`，那里记着已装依赖、推荐候选和各自的引入时机。要点：

- 能不装就不装：能用原生 API（`Intl`、`crypto.randomUUID`、`matchMedia`、`structuredClone`）解决的，不引入第三方
- 默认零运行时依赖：新的运行时包必须说明「体积 / 是否可 lazy / 替代方案是什么」，并在 PR 或提交信息里写清
- 日期与解析优先自研：自然语言日期按中文规则自己写，需要兜底时才考虑 `chrono-node`
- 校验不要引重包：数据校验已经在 `src/lib/todoStore.ts` 手写，若后续要上 schema，选 `valibot`（可摇树）而不是 `zod`
- 状态管理先用 React 自带的 `useState` / `useReducer` / context，别为了几个字段引 `zustand`
- 测试默认 Vitest 纯函数，不要盲上 `jsdom`；确实要测 DOM 时才装 `@testing-library/react` + `happy-dom`
- UI 组件不用整包组件库，继续用本地 vendor 的 react-bits + 手写 CSS；`clsx` 这类微型工具可用可不用

