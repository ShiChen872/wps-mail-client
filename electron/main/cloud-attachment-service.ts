import type { WpsMailApiClient } from "@wps-mail/mail-api";
import type { AppConfig } from "./config";

export interface CloudLinkItem {
  name: string;
  url: string;
  html: string;
}

export interface CloudDocSelection {
  driveId: string;
  fileId: string;
  name: string;
  linkUrl?: string;
}

export function linkHtml(name: string, url: string): string {
  const safeName = name.replace(/</g, "&lt;").replace(/"/g, "&quot;");
  const safeUrl = url.replace(/"/g, "&quot;");
  return (
    `<div class="wps-cloud-attach" style="margin:12px 0;padding:10px 12px;border:1px solid #e4e6eb;border-radius:8px;background:#f8f9fb;">` +
    `<p style="margin:0;font-size:13px;color:#1f2329;">` +
    `📎 云文档：<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${safeName}</a>` +
    `</p>` +
    `<p style="margin:6px 0 0;font-size:12px;color:#5c6b7a;word-break:break-all;">` +
    `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${safeUrl}</a>` +
    `</p></div>`
  );
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

/** 为已有云文档生成分享链接并返回可插入正文的 HTML */
export async function createCloudLinkForSelection(
  api: WpsMailApiClient,
  config: AppConfig,
  selection: CloudDocSelection
): Promise<CloudLinkItem> {
  const url = await openShareUrl(
    api,
    config,
    selection.driveId,
    selection.fileId,
    selection.linkUrl
  );
  return {
    name: selection.name,
    url,
    html: linkHtml(selection.name, url),
  };
}

export async function createCloudLinksForSelections(
  api: WpsMailApiClient,
  config: AppConfig,
  selections: CloudDocSelection[]
): Promise<{ items: CloudLinkItem[]; errors: { name: string; message: string }[] }> {
  const items: CloudLinkItem[] = [];
  const errors: { name: string; message: string }[] = [];

  for (const selection of selections) {
    try {
      items.push(await createCloudLinkForSelection(api, config, selection));
    } catch (e) {
      errors.push({
        name: selection.name,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return { items, errors };
}
