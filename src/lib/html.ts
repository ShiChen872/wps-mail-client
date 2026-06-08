import { rewriteQuarantineButtons } from "./quarantine-mail";

/** 判断字符串是否像 HTML 邮件正文 */
export function looksLikeHtml(s: string): boolean {
  return /<\s*[a-z][\s\S]*>/i.test(s);
}

/** 纯文本转简单 HTML（保留换行） */
export function plainTextToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<div style="font-family:Segoe UI,Microsoft YaHei,sans-serif;font-size:14px;line-height:1.5;">${escaped
    .split(/\n/)
    .map((line) => (line ? `<p>${line}</p>` : "<p><br></p>"))
    .join("")}</div>`;
}

function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

/** 纯文本中的 URL 转为可点击链接 */
export function linkifyPlainText(text: string): string {
  const urlRe = /(https?:\/\/[^\s<>"')\]]+)/gi;
  return text.replace(urlRe, (raw) => {
    const trimmed = raw.replace(/[.,;:!?]+$/, "");
    const suffix = raw.slice(trimmed.length);
    return `<a href="${escapeHtmlAttr(trimmed)}" rel="noopener noreferrer">${trimmed}</a>${suffix}`;
  });
}

export function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

/** 去掉邮件外层重复的 html/body 包裹，避免读信 DOM 解析异常 */
export function extractMailBodyFragment(raw: string): string {
  let html = raw.trim();
  if (!looksLikeHtml(html)) return html;

  const bodyMatch = html.match(/<body\b[^>]*>([\s\S]*)<\/body>/i);
  if (bodyMatch) {
    html = bodyMatch[1].trim();
    const innerBody = html.match(/<body\b[^>]*>([\s\S]*)<\/body>/i);
    if (innerBody) html = innerBody[1].trim();
  }

  return html
    .replace(/<\/body>\s*<\/html>\s*$/i, "")
    .replace(/<\/html>\s*$/i, "")
    .trim();
}

/**
 * 将 <a href> 改为 data-href 的 span，避免 Electron 内嵌页面默认导航吞掉点击。
 */
export function rewriteMailLinksForReader(html: string): string {
  return html.replace(
    /<a\b([^>]*?)href\s*=\s*["']([^"']+)["']([^>]*)>([\s\S]*?)<\/a>/gi,
    (_full, _pre, href, _post, text) => {
      const url = decodeHtmlEntities(href).trim();
      if (!/^https?:\/\//i.test(url)) {
        return `<span>${text}</span>`;
      }
      const safeUrl = escapeHtmlAttr(url);
      return (
        `<span class="mail-external-link" data-href="${safeUrl}" role="link" tabindex="0"` +
        ` style="color:#1677ff;text-decoration:underline;cursor:pointer;">${text}</span>`
      );
    }
  );
}

/** 读信前清理危险标签，保留常见排版与链接 */
export function sanitizeMailHtml(
  raw: string,
  opts: { linkify?: boolean } = {}
): string {
  let html = extractMailBodyFragment(raw)
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");

  html = rewriteQuarantineButtons(html);

  if (opts.linkify && !looksLikeHtml(html)) {
    const escaped = html
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    html = linkifyPlainText(escaped);
  } else {
    html = rewriteMailLinksForReader(html);
  }

  return html;
}

/** 读信：纯文本正文转 HTML（保留换行 + 自动识别 URL） */
export function plainTextToReaderHtml(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return rewriteMailLinksForReader(
    `<div style="white-space:pre-wrap;font-family:inherit;">${linkifyPlainText(escaped)}</div>`
  );
}

/** 发送前规范化正文：富文本用 HTML，纯文本包一层 */
export function normalizeComposeBody(body: string, isHtml: boolean): string {
  const trimmed = body.trim();
  if (!trimmed) return "";
  if (isHtml || looksLikeHtml(trimmed)) {
    return trimmed;
  }
  return plainTextToHtml(trimmed);
}
