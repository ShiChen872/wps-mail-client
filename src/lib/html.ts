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

/** 发送前规范化正文：富文本用 HTML，纯文本包一层 */
export function normalizeComposeBody(body: string, isHtml: boolean): string {
  const trimmed = body.trim();
  if (!trimmed) return "";
  if (isHtml || looksLikeHtml(trimmed)) {
    return trimmed;
  }
  return plainTextToHtml(trimmed);
}
