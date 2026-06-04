import fs from "fs";
import path from "path";
import type { MailListItem } from "@wps-mail/mail-api";
import { getDataDir } from "./config";

export interface CachedMessageRow {
  message_id: string;
  mailbox_id: string;
  /** API 返回的真实目录 ID（getMessage 必用） */
  folder_id: string;
  /** 同步时使用的系统目录别名：inbox / sent / drafts 等 */
  sync_folder: string;
  subject: string;
  body_preview: string | null;
  ctime: number;
  from_json: string | null;
  to_json: string | null;
  is_read: number;
  is_flag: number;
  is_draft: number;
  has_attachments: number;
  thread_id: string | null;
  body_html: string | null;
  synced_at: number;
}

interface StoreShape {
  sync_state: Record<string, string>;
  folder_sync: Record<
    string,
    { page_token: string | null; last_sync_at: number }
  >;
  messages: Record<string, CachedMessageRow>;
}

function msgKey(mailboxId: string, messageId: string) {
  return `${mailboxId}|${messageId}`;
}

function folderKey(mailboxId: string, syncFolder: string) {
  return `${mailboxId}|${syncFolder}`;
}

/** 本地 JSON 持久化缓存 */
export class MailDatabase {
  private filePath: string;
  private data: StoreShape;

  constructor() {
    const dir = getDataDir();
    fs.mkdirSync(dir, { recursive: true });
    this.filePath = path.join(dir, "mail-store.json");
    this.data = this.load();
  }

  private load(): StoreShape {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = JSON.parse(
          fs.readFileSync(this.filePath, "utf8")
        ) as StoreShape;
        for (const row of Object.values(raw.messages ?? {})) {
          if (!row.sync_folder) {
            row.sync_folder = row.folder_id;
          }
          if (row.is_draft === undefined) {
            row.is_draft = row.sync_folder === "drafts" ? 1 : 0;
          }
        }
        return raw;
      }
    } catch {
      /* corrupt file */
    }
    return { sync_state: {}, folder_sync: {}, messages: {} };
  }

  private persist(): void {
    fs.writeFileSync(this.filePath, JSON.stringify(this.data), "utf8");
  }

  getSyncState(key: string): string | null {
    return this.data.sync_state[key] ?? null;
  }

  setSyncState(key: string, value: string): void {
    this.data.sync_state[key] = value;
    this.persist();
  }

  /** @param syncFolder 系统目录别名（inbox/sent/...），用于列表分组 */
  upsertMessages(items: MailListItem[], syncFolder: string): void {
    const now = Date.now();
    for (const m of items) {
      const key = msgKey(m.mailbox_id, m.message_id);
      const apiFolderId = m.folder_id?.trim() || syncFolder;
      this.data.messages[key] = {
        message_id: m.message_id,
        mailbox_id: m.mailbox_id,
        folder_id: apiFolderId,
        sync_folder: syncFolder,
        subject: m.subject ?? "",
        body_preview: m.body_preview ?? null,
        ctime: m.ctime ?? 0,
        from_json: m.from ? JSON.stringify(m.from) : null,
        to_json: m.to_recipient ? JSON.stringify(m.to_recipient) : null,
        is_read: m.is_read ? 1 : 0,
        is_flag: m.is_flag ? 1 : 0,
        is_draft: m.is_draft ? 1 : 0,
        has_attachments: m.has_attachments ? 1 : 0,
        thread_id: m.thread_id ?? null,
        body_html: this.data.messages[key]?.body_html ?? null,
        synced_at: now,
      };
    }
    this.persist();
  }

  cacheMessageBody(mailboxId: string, messageId: string, body: string): void {
    const key = msgKey(mailboxId, messageId);
    const row = this.data.messages[key];
    if (row) {
      row.body_html = body;
      row.synced_at = Date.now();
      this.persist();
    }
  }

  listCached(
    mailboxId: string,
    syncFolder: string,
    limit = 100
  ): CachedMessageRow[] {
    return Object.values(this.data.messages)
      .filter(
        (r) => r.mailbox_id === mailboxId && r.sync_folder === syncFolder
      )
      .sort((a, b) => b.ctime - a.ctime)
      .slice(0, limit);
  }

  getFolderPageToken(mailboxId: string, syncFolder: string): string | null {
    return (
      this.data.folder_sync[folderKey(mailboxId, syncFolder)]?.page_token ?? null
    );
  }

  setFolderPageToken(
    mailboxId: string,
    syncFolder: string,
    pageToken: string | null
  ): void {
    this.data.folder_sync[folderKey(mailboxId, syncFolder)] = {
      page_token: pageToken,
      last_sync_at: Date.now(),
    };
    this.persist();
  }

  countUnreadInbox(mailboxId: string): number {
    return Object.values(this.data.messages).filter(
      (r) =>
        r.mailbox_id === mailboxId &&
        r.sync_folder === "inbox" &&
        r.is_read === 0
    ).length;
  }

  countUnreadFolder(mailboxId: string, syncFolder: string): number {
    return Object.values(this.data.messages).filter(
      (r) =>
        r.mailbox_id === mailboxId &&
        r.sync_folder === syncFolder &&
        r.is_read === 0
    ).length;
  }

  getCachedRow(
    mailboxId: string,
    messageId: string
  ): CachedMessageRow | null {
    return this.data.messages[msgKey(mailboxId, messageId)] ?? null;
  }

  setMessageRead(
    mailboxId: string,
    messageId: string,
    isRead: boolean
  ): void {
    const row = this.data.messages[msgKey(mailboxId, messageId)];
    if (row) {
      row.is_read = isRead ? 1 : 0;
      row.synced_at = Date.now();
      this.persist();
    }
  }

  removeMessage(mailboxId: string, messageId: string): void {
    delete this.data.messages[msgKey(mailboxId, messageId)];
    this.persist();
  }

  moveMessageLocal(
    mailboxId: string,
    messageId: string,
    targetSyncFolder: string,
    targetFolderId: string
  ): void {
    const row = this.data.messages[msgKey(mailboxId, messageId)];
    if (row) {
      row.sync_folder = targetSyncFolder;
      row.folder_id = targetFolderId;
      row.synced_at = Date.now();
      this.persist();
    }
  }

  /** 从缓存提取近期联系人邮箱（写信联想兜底） */
  recentRecipientEmails(mailboxId: string, limit = 30): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    const rows = Object.values(this.data.messages)
      .filter((r) => r.mailbox_id === mailboxId)
      .sort((a, b) => b.ctime - a.ctime);
    for (const row of rows) {
      for (const json of [row.from_json, row.to_json]) {
        if (!json) continue;
        try {
          const parsed = JSON.parse(json) as
            | { email_address?: string }
            | { email_address?: string }[];
          const list = Array.isArray(parsed) ? parsed : [parsed];
          for (const r of list) {
            const e = r.email_address?.trim();
            if (e && !seen.has(e)) {
              seen.add(e);
              out.push(e);
              if (out.length >= limit) return out;
            }
          }
        } catch {
          /* ignore */
        }
      }
    }
    return out;
  }

  clearMessages(): void {
    this.data.messages = {};
    this.persist();
  }

  close(): void {
    this.persist();
  }
}
