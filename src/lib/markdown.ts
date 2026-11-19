/**
 * C5-6 · 轻量 Markdown 只读渲染（自研，零依赖）
 *
 * 仅支持三种语法：
 *   - **加粗**
 *   - 行首 `- ` 无序列表
 *   - [文本](url) 链接（自动加 rel="noopener noreferrer" target="_blank"）
 *
 * 安全约定：
 *   1. 所有文本先做 HTML 实体转义（& < > " '），任何 <script> 注入都会变成纯文本。
 *   2. javascript: / data: / vbscript: 协议的链接一律降级为纯文本，不产出 <a>。
 *   3. 未匹配的语法原样显示。
 *
 * 输出为「片段 HTML」字符串，宿主用 dangerouslySetInnerHTML 注入 ——
 * 这是唯一允许的地方，安全性完全由本模块的转义保证（配套测试覆盖注入用例）。
 */

/** 转义全部 HTML 实体，杜绝标签注入 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** 只允许 http(s) 与协议相对链接；javascript:/data:/vbscript: 一律拒绝 */
function isSafeUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (/^(https?:|mailto:)/i.test(trimmed)) return true;
  // 相对路径（./x、/x、#锚点、普通相对名）
  return !/^[a-z][a-z0-9+.-]*:/i.test(trimmed) && !trimmed.startsWith("//");
}

/** 行内渲染：先转义，再处理链接与加粗（链接文本里不再嵌套加粗，保持简单可预期） */
function renderInline(raw: string): string {
  const escaped = escapeHtml(raw);

  // [文本](url)：url 里不允许裸空格，括号内不嵌套
  const withLinks = escaped.replace(
    /\[([^\]]+)\]\(([^)\s]+)\)/g,
    (whole, label: string, url: string) => {
      if (!isSafeUrl(url)) return whole; // 危险协议：原样显示为纯文本
      return `<a href="${url}" rel="noopener noreferrer" target="_blank">${label}</a>`;
    },
  );

  // **加粗**：非贪婪配对，不跨行
  return withLinks.replace(/\*\*([^*]+(?:\*(?!\*)[^*]*)*)\*\*/g, "<strong>$1</strong>");
}

export type MarkdownBlock =
  | { kind: "paragraph"; html: string }
  | { kind: "list"; html: string };

/** 单行是否为列表项（允许行首最多 3 个空格缩进） */
function isListItem(line: string): boolean {
  return /^ {0,3}-(?: |$)/.test(line);
}

/** 去掉列表标记后的内容 */
function listItemContent(line: string): string {
  return line.replace(/^ {0,3}-(?: |$)/, "");
}

/**
 * 渲染轻量 Markdown 为 HTML 片段。
 * 逐行处理：连续 `- ` 行聚合成一个 <ul>，其余每行一个 <p>；
 * 单个换行也在 <p> 内以 <br> 呈现（备忘录手写习惯）。
 */
export function renderMarkdown(source: string): string {
  const text = typeof source === "string" ? source : "";
  if (!text.trim()) return "";

  const blocks: MarkdownBlock[] = [];
  const lines = text.split(/\r?\n/);

  let listBuffer: string[] = [];
  let paragraphBuffer: string[] = [];

  function flushList() {
    if (listBuffer.length === 0) return;
    const html = `<ul>${listBuffer
      .map((item) => `<li>${renderInline(item)}</li>`)
      .join("")}</ul>`;
    blocks.push({ kind: "list", html });
    listBuffer = [];
  }

  function flushParagraph() {
    if (paragraphBuffer.length === 0) return;
    const html = `<p>${paragraphBuffer.map(renderInline).join("<br>")}</p>`;
    blocks.push({ kind: "paragraph", html });
    paragraphBuffer = [];
  }

  for (const line of lines) {
    if (isListItem(line)) {
      flushParagraph();
      listBuffer.push(listItemContent(line));
    } else if (line.trim() === "") {
      flushList();
      flushParagraph();
    } else {
      flushList();
      paragraphBuffer.push(line);
    }
  }
  flushList();
  flushParagraph();

  return blocks.map((block) => block.html).join("");
}
