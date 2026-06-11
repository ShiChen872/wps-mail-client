/** 为写信正文中的附件块包裹可追踪 ID，便于移除时同步删除 HTML */
export function wrapComposeFileBlock(id: string, innerHtml: string): string {
  return `<div data-wps-compose-file="${id}" class="wps-compose-file">${innerHtml}</div>`;
}

/** 从 HTML 正文中移除指定附件块 */
export function removeComposeFileFromBody(bodyHtml: string, fileId: string): string {
  if (!bodyHtml || !fileId) return bodyHtml;

  const escaped = fileId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const wrapperRe = new RegExp(
    `<div\\s[^>]*data-wps-compose-file="${escaped}"[^>]*>[\\s\\S]*?</div>\\s*`,
    "i"
  );
  const stripped = bodyHtml.replace(wrapperRe, "");
  if (stripped !== bodyHtml) return stripped;

  return bodyHtml;
}

export function composeFileStatusSummary(
  embedded: number,
  cloud: number,
  failed: number
): string {
  const parts: string[] = [];
  if (embedded > 0) {
    parts.push(`${embedded} 张图片已嵌入正文`);
  }
  if (cloud > 0) {
    parts.push(`${cloud} 个文档已转为云文档链接`);
  }
  if (failed > 0) {
    parts.push(`${failed} 个失败`);
  }
  return parts.length ? parts.join("；") : "未添加文件";
}
