import { describe, expect, it } from "vitest";
import { renderMarkdown } from "./markdown";

describe("renderMarkdown · 基础语法 (C5-6)", () => {
  it("renders empty / blank input as empty string", () => {
    expect(renderMarkdown("")).toBe("");
    expect(renderMarkdown("   \n  ")).toBe("");
  });

  it("keeps plain text as a paragraph", () => {
    expect(renderMarkdown("随手记一笔")).toBe("<p>随手记一笔</p>");
  });

  it("renders **bold**", () => {
    expect(renderMarkdown("这是**加粗**文字")).toBe("<p>这是<strong>加粗</strong>文字</p>");
  });

  it("leaves unmatched syntax as-is", () => {
    expect(renderMarkdown("单个 * 星号与 **未闭合")).toBe("<p>单个 * 星号与 **未闭合</p>");
    expect(renderMarkdown("[没有链接的方括号]")).toBe("<p>[没有链接的方括号]</p>");
  });

  it("renders - lists", () => {
    expect(renderMarkdown("- 第一\n- 第二")).toBe(
      "<ul><li>第一</li><li>第二</li></ul>",
    );
  });

  it("keeps non-list hyphen lines as paragraphs", () => {
    expect(renderMarkdown("a-b 没有空格")).toBe("<p>a-b 没有空格</p>");
  });

  it("renders links with noopener and target", () => {
    expect(renderMarkdown("[首页](https://example.com)")).toBe(
      '<p><a href="https://example.com" rel="noopener noreferrer" target="_blank">首页</a></p>',
    );
  });

  it("supports bold and links in list items", () => {
    expect(renderMarkdown("- **重点**看[文档](https://e.com/a)")).toBe(
      '<ul><li><strong>重点</strong>看<a href="https://e.com/a" rel="noopener noreferrer" target="_blank">文档</a></li></ul>',
    );
  });

  it("escapes all HTML entities first", () => {
    expect(renderMarkdown('1 < 2 & "x"')).toBe(
      "<p>1 &lt; 2 &amp; &quot;x&quot;</p>",
    );
  });

  it("merges consecutive lines into one paragraph with <br>", () => {
    expect(renderMarkdown("第一行\n第二行")).toBe("<p>第一行<br>第二行</p>");
  });
});

describe("renderMarkdown · 注入防护 (C5-6)", () => {
  it("neutralizes <script> injection", () => {
    const html = renderMarkdown("<script>alert(1)</script>");
    expect(html).toBe("<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>");
    expect(html).not.toContain("<script");
  });

  it("neutralizes <script> inside list items and link labels", () => {
    const html = renderMarkdown("- <script>x</script>\n[<script>y</script>](https://e.com)");
    expect(html).not.toContain("<script");
  });

  it("downgrades javascript: links to plain text", () => {
    const html = renderMarkdown("[点我](javascript:alert(1))");
    expect(html).not.toContain("<a ");
    expect(html).toContain("[点我](javascript:alert(1))");
  });

  it("downgrades data: and vbscript: links to plain text", () => {
    expect(renderMarkdown("[a](data:text/html,<b>x</b>)")).not.toContain("<a ");
    expect(renderMarkdown("[b](vbscript:msgbox)")).not.toContain("<a ");
  });

  it("downgrades protocol-relative and unknown-scheme links", () => {
    expect(renderMarkdown("[c](//evil.example)")).not.toContain("<a ");
    expect(renderMarkdown("[d](ftp://x)")).not.toContain("<a ");
  });

  it("does not break out of the href attribute", () => {
    const html = renderMarkdown('[x](https://e.com/" onmouseover="alert(1))');
    // url 部分不允许空格，整段不构成合法链接 → 纯文本（引号也已转义成 &quot;）
    expect(html).not.toContain('<a ');
    expect(html).not.toContain('onmouseover="');
    expect(html).toContain("&quot;");
  });

  it("escapes quotes so attributes cannot be closed by link text or url", () => {
    const html = renderMarkdown('["](https://e.com/a)');
    expect(html).not.toContain('" onmouseover');
  });
});


describe("renderMarkdown · 边界与放行规则 (C5-6)", () => {
  it("允许 mailto 与相对链接", () => {
    expect(renderMarkdown("[写信](mailto:me@example.com)")).toContain('<a href="mailto:me@example.com"');
    expect(renderMarkdown("[关于](/about)")).toContain('<a href="/about"');
    expect(renderMarkdown("[跳转](#top)")).toContain('<a href="#top"');
  });

  it("链接文字里的尖括号与引号同样被转义", () => {
    const html = renderMarkdown('[<img "x" onerror=1>](https://e.com)');
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
    expect(html).toContain("&quot;x&quot;");
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it("列表项里的 HTML 也被转义", () => {
    expect(renderMarkdown("- <b>粗</b>")).toBe("<ul><li>&lt;b&gt;粗&lt;/b&gt;</li></ul>");
  });

  it("多个空行不会产出空段落", () => {
    expect(renderMarkdown("A\n\n\nB")).toBe("<p>A</p><p>B</p>");
  });

  it("列表与段落混排时各自成块", () => {
    expect(renderMarkdown("开头\n- 一\n- 二\n结尾")).toBe(
      "<p>开头</p><ul><li>一</li><li>二</li></ul><p>结尾</p>",
    );
  });

  it("不支持语法（标题 / 引用 / 斜体）原样保留", () => {
    expect(renderMarkdown("# 标题")).toBe("<p># 标题</p>");
    expect(renderMarkdown("> 引用")).toBe("<p>&gt; 引用</p>");
    expect(renderMarkdown("*斜体*")).toBe("<p>*斜体*</p>");
  });

  it("非字符串入参退化为空串", () => {
    expect(renderMarkdown(null as unknown as string)).toBe("");
    expect(renderMarkdown(undefined as unknown as string)).toBe("");
  });
});