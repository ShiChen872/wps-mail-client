import fs from "fs";
import path from "path";

export const IMAGE_EXT = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".bmp",
]);

export const MAX_EMBED_BYTES = 2 * 1024 * 1024;

function mimeForExt(ext: string): string {
  const map: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".bmp": "image/bmp",
  };
  return map[ext] ?? "image/png";
}

export function canEmbedImageFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  if (!IMAGE_EXT.has(ext)) return false;
  try {
    return fs.statSync(filePath).size <= MAX_EMBED_BYTES;
  } catch {
    return false;
  }
}

/** 单张图片的 HTML 嵌入块（不含外层 body 包裹） */
export function imageEmbedHtmlBlock(filePath: string): string | null {
  if (!canEmbedImageFile(filePath)) return null;
  const name = path.basename(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const data = fs.readFileSync(filePath);
  const b64 = data.toString("base64");
  const mime = mimeForExt(ext);
  return (
    `<p style="margin:12px 0 4px;color:#666;font-size:12px;">${name}</p>` +
    `<p><img src="data:${mime};base64,${b64}" alt="${name.replace(/"/g, "&quot;")}" style="max-width:100%;height:auto;" /></p>`
  );
}

/**
 * OpenAPI 暂无邮件附件上传路由时，将图片以 data URI 嵌入 HTML 正文。
 */
export function embedImagesInHtmlBody(
  body: string,
  isHtml: boolean,
  filePaths: string[]
): {
  body: string;
  embedded: string[];
  remainingPaths: string[];
} {
  const embedded: string[] = [];
  const remainingPaths: string[] = [];
  const blocks: string[] = [];

  let htmlBody = body;
  if (!isHtml) {
    const escaped = body
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    htmlBody = `<div style="font-family:Segoe UI,Microsoft YaHei,sans-serif;font-size:14px;">${escaped
      .split(/\n/)
      .map((l) => `<p>${l || "<br>"}</p>`)
      .join("")}</div>`;
  }

  for (const filePath of filePaths) {
    const ext = path.extname(filePath).toLowerCase();
    const name = path.basename(filePath);
    if (!IMAGE_EXT.has(ext)) {
      remainingPaths.push(filePath);
      continue;
    }
    const stat = fs.statSync(filePath);
    if (stat.size > MAX_EMBED_BYTES) {
      remainingPaths.push(filePath);
      continue;
    }
    const data = fs.readFileSync(filePath);
    const b64 = data.toString("base64");
    const mime = mimeForExt(ext);
    blocks.push(
      `<p style="margin:12px 0 4px;color:#666;font-size:12px;">${name}</p>` +
        `<p><img src="data:${mime};base64,${b64}" alt="${name.replace(/"/g, "&quot;")}" style="max-width:100%;height:auto;" /></p>`
    );
    embedded.push(name);
  }

  if (blocks.length === 0) {
    return { body, embedded, remainingPaths };
  }

  const merged = `${htmlBody}<div class="wps-embedded-images">${blocks.join("")}</div>`;
  return { body: merged, embedded, remainingPaths };
}
