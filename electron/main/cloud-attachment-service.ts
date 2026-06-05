import crypto from "crypto";
import fs from "fs";
import path from "path";
import type { WpsMailApiClient } from "@wps-mail/mail-api";
import type { AppConfig } from "./config";

const ROOT_PARENT_ID = "0";
const UPLOAD_FOLDER = ["WPS Mail", "附件"];

export interface CloudLinkItem {
  name: string;
  url: string;
  html: string;
}

function fileHashes(buf: Buffer) {
  return [
    { type: "md5" as const, sum: crypto.createHash("md5").update(buf).digest("hex") },
    {
      type: "sha256" as const,
      sum: crypto.createHash("sha256").update(buf).digest("hex"),
    },
  ];
}

function linkHtml(name: string, url: string): string {
  const safeName = name.replace(/</g, "&lt;").replace(/"/g, "&quot;");
  const safeUrl = url.replace(/"/g, "&quot;");
  return (
    `<div class="wps-cloud-attach" style="margin:12px 0;padding:10px 12px;border:1px solid #e4e6eb;border-radius:8px;background:#f8f9fb;">` +
    `<p style="margin:0;font-size:13px;color:#1f2329;">` +
    `📎 附件（WPS 云文档）：<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${safeName}</a>` +
    `</p></div>`
  );
}

async function putToStore(
  store: { method: string; url: string },
  data: Buffer,
  token: string
): Promise<void> {
  const headers: Record<string, string> = {};
  if (store.url.includes("wps.cn") || store.url.includes("kdocs.cn")) {
    headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(store.url, {
    method: store.method || "PUT",
    headers,
    body: data,
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`云存储上传失败 (${res.status}): ${t.slice(0, 120)}`);
  }
}

async function resolvePrimaryDrive(api: WpsMailApiClient) {
  const data = await api.yundoc.listUserDrives("special");
  const drive = data.items?.[0];
  if (!drive?.id) {
    throw new Error(
      "未找到「我的云文档」驱动盘。请确认已开通 kso.drive.readwrite 并重新登录。"
    );
  }
  return drive.id;
}

async function openShareUrl(
  api: WpsMailApiClient,
  config: AppConfig,
  driveId: string,
  fileId: string,
  existingLink?: string
): Promise<string> {
  if (existingLink?.startsWith("http")) return existingLink;

  const roles = [config.cloudLinkRoleId, "viewable", "view_only"].filter(
    Boolean
  ) as string[];
  let lastErr: Error | null = null;
  for (const role_id of [...new Set(roles)]) {
    try {
      const link = await api.yundoc.openFileLink(driveId, fileId, {
        scope: config.cloudLinkScope,
        role_id,
        opts: { expire_period: config.cloudLinkExpireDays },
      });
      if (link.url) return link.url;
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
    }
  }
  throw lastErr ?? new Error("开启云文档分享链接失败");
}

export async function createCloudLinkForFile(
  api: WpsMailApiClient,
  config: AppConfig,
  filePath: string,
  getAccessToken: () => Promise<string | null>
): Promise<CloudLinkItem> {
  const token = await getAccessToken();
  if (!token) throw new Error("未登录");

  const name = path.basename(filePath);
  const data = fs.readFileSync(filePath);
  const driveId = await resolvePrimaryDrive(api);

  const uploadMeta = await api.yundoc.requestFileUpload(
    driveId,
    ROOT_PARENT_ID,
    {
      name,
      size: data.length,
      hashes: fileHashes(data),
      parent_path: UPLOAD_FOLDER,
      on_name_conflict: "rename",
    }
  );

  await putToStore(uploadMeta.store_request, data, token);

  const committed = await api.yundoc.commitFileUpload(
    driveId,
    ROOT_PARENT_ID,
    uploadMeta.upload_id
  );

  const fileId = committed.id;
  if (!fileId) throw new Error("上传完成但未返回文件 ID");

  const url = await openShareUrl(
    api,
    config,
    driveId,
    fileId,
    committed.link_url
  );

  return { name, url, html: linkHtml(name, url) };
}

export async function createCloudLinksForFiles(
  api: WpsMailApiClient,
  config: AppConfig,
  filePaths: string[],
  getAccessToken: () => Promise<string | null>
): Promise<{ items: CloudLinkItem[]; errors: { name: string; message: string }[] }> {
  const items: CloudLinkItem[] = [];
  const errors: { name: string; message: string }[] = [];

  for (const filePath of filePaths) {
    const name = path.basename(filePath);
    try {
      items.push(
        await createCloudLinkForFile(api, config, filePath, getAccessToken)
      );
    } catch (e) {
      errors.push({
        name,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return { items, errors };
}
