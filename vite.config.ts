import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

/**
 * 把 JS / CSS 全部内联进 index.html，产出可双击打开的单文件。
 *
 * 为什么必须这么做：
 * 1. file:// 下浏览器不给 `<script type="module">` 放行（origin 为 null，模块加载走 CORS）；
 * 2. 默认 base 是 '/'，产物里是 `/assets/index-xxx.js`，双击后会被解析成 `file:///assets/...`（盘符根目录）。
 * 于是双击打开只剩白屏。这里改成相对路径 + iife 普通脚本 + 资源全内联，两处问题一起解决。
 */
function inlineSingleFile(): Plugin {
  return {
    name: 'whim-todo:inline-single-file',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const htmlKey = Object.keys(bundle).find((key) => key.endsWith('.html'))
      const htmlFile = htmlKey ? bundle[htmlKey] : undefined
      if (!htmlFile || htmlFile.type !== 'asset') return

      let html = String(htmlFile.source)
      const scripts: string[] = []

      // 取走被引用的资源（css 是 asset，js 是 chunk，内容分别在 source / code），
      // 取走即从产物里删掉，不再单独输出文件
      const takeAsset = (url: string) => {
        const key = url.replace(/^[./]+/, '').split(/[?#]/)[0]
        const file = bundle[key]
        if (!file) return null
        delete bundle[key]
        return file.type === 'asset' ? String(file.source) : file.code
      }

      // 样式表就地内联
      html = html.replace(/<link\b[^>]*rel="stylesheet"[^>]*>/g, (tag) => {
        const href = /\bhref="([^"]+)"/.exec(tag)?.[1]
        const css = href ? takeAsset(href) : null
        return css ? `<style>${css}</style>` : tag
      })

      // 动态 import 已合并进主脚本，modulepreload 链接没有意义
      html = html.replace(/<link\b[^>]*rel="modulepreload"[^>]*>\s*/g, '')

      // 外链脚本先摘下来，等下统一放到 body 末尾
      html = html.replace(/<script\b[^>]*\ssrc="([^"]+)"[^>]*>\s*<\/script>\s*/gi, (_tag, src: string) => {
        const js = takeAsset(src)
        if (js) scripts.push(js)
        return ''
      })

      if (scripts.length > 0) {
        // 代码里出现 </script> 会把内联脚本提前截断，必须转义
        const inlineJs = scripts.join('\n').replace(/<\/script/gi, '<\\/script')
        // 放到 </body> 前：普通 <script> 是同步执行的，放 head 里会赶在 #root 之前跑
        let injected = false
        html = html.replace(/<\/body>/i, () => {
          injected = true
          return `    <script>${inlineJs}</script>\n  </body>`
        })
        if (!injected) html += `<script>${inlineJs}</script>`
      }

      htmlFile.source = html
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  // 兜底：万一还有漏网的外链资源，也走相对路径而不是盘符根
  base: './',
  plugins: [react(), inlineSingleFile()],
  build: {
    // 图片一律转 base64 内联，不再单独产出 assets 目录
    assetsInlineLimit: Number.MAX_SAFE_INTEGER,
    cssCodeSplit: false,
    modulePreload: false,
    rolldownOptions: {
      output: {
        // iife：单个普通脚本，file:// 下可直接执行（rolldown 会因非 esm 格式自动关掉代码分割）
        format: 'iife',
      },
      // preload-helper 里的 import.meta 在 iife 下会被置空；modulePreload 已关，这段代码走不到，警告可以忽略
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- rolldown 的 OnwarnFunction 参数类型过窄
      onwarn(warning: any, defaultHandler: any) {
        if (warning.code === 'EMPTY_IMPORT_META') return
        defaultHandler(warning)
      },
    },
  },
})
