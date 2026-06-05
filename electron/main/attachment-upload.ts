import path from "path";
import type { WpsMailApiClient } from "@wps-mail/mail-api";
import type { AppConfig } from "./config";

function guessMime(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const map: Record<string, string> = {
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".txt": "text/plain",
    ".html": "text/html",
    ".doc": "application/msword",
    ".docx":
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xls": "application/vnd.ms-excel",
    ".xlsx":
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".zip": "application/zip",
  };
  return map[ext] ?? "application/octet-stream";
}

/** JSON 方式失败后，用 multipart 再试上传 */
export async function uploadAttachmentMultipart(
  api: WpsMailApiClient,
  config: AppConfig,
  mailboxId: string,
  messageId: string,
  filePath: string,
  getAccessToken: () => Promise<string | null>
): Promise<void> {
  const token = await getAccessToken();
  if (!token) throw new Error("未登录");

  const fs = await import("fs");
  const data = fs.readFileSync(filePath);
  const filename = path.basename(filePath);
  const mimeType = guessMime(filename);
  const base = config.apiBase.replace(/\/$/, "");
  const msgPath = `/v7/mailboxes/${encodeURIComponent(mailboxId)}/messages/${encodeURIComponent(messageId)}`;

  for (const suffix of ["/attachments/upload", "/attachments/create"]) {
    const url = `${base}${msgPath}${suffix}`;
    const form = new FormData();
    const blob = new Blob([data], { type: mimeType });
    form.append("file", blob, filename);
    form.append("filename", filename);
    form.append("mime_type", mimeType);

    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    const text = await res.text();
    let json: { code?: number; msg?: string };
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      continue;
    }
    if (res.ok && (json.code === undefined || json.code === 0)) {
      return;
    }
  }

  throw new Error("multipart 附件上传失败");
}

export async function uploadAttachmentsForMessage(
  api: WpsMailApiClient,
  config: AppConfig,
  mailboxId: string,
  messageId: string,
  filePaths: string[],
  getAccessToken: () => Promise<string | null>
): Promise<{ uploaded: number; failed: string[] }> {
  const failed: string[] = [];
  let uploaded = 0;
  const fs = await import("fs");

  for (const filePath of filePaths) {
    const filename = path.basename(filePath);
    const mimeType = guessMime(filename);
    const data = fs.readFileSync(filePath);
    try {
      await api.uploadMessageAttachment(mailboxId, messageId, {
        filename,
        mimeType,
        data,
      });
      uploaded += 1;
    } catch {
      try {
        await uploadAttachmentMultipart(
          api,
          config,
          mailboxId,
          messageId,
          filePath,
          getAccessToken
        );
        uploaded += 1;
      } catch {
        failed.push(filename);
      }
    }
  }

  return { uploaded, failed };
}
