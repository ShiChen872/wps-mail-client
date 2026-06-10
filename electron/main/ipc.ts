import { ipcMain, dialog, shell, Notification } from "electron";
import type { AuthService } from "./auth-service";
import type { MailDatabase, CachedMessageRow } from "./db";
import type { SyncService } from "./sync-service";
import type { AppConfig } from "./config";
import { isConfigValid } from "./config";
import type { CreateDraftBody, MailRecipient } from "@wps-mail/mail-api";
import { embedImagesInHtmlBody } from "./attachment-embed";
import { uploadAttachmentsForMessage } from "./attachment-upload";
import {
  createCloudLinksForSelections,
  type CloudDocSelection,
} from "./cloud-attachment-service";
import { executeQuarantineAction } from "./quarantine-audit-service";
import { processComposeFiles } from "./compose-file-service";
import path from "path";

function rowToListItem(row: CachedMessageRow) {
  return {
    message_id: row.message_id,
    mailbox_id: row.mailbox_id,
    folder_id: row.folder_id,
    subject: row.subject,
    body_preview: row.body_preview ?? undefined,
    ctime: row.ctime,
    from: row.from_json ? JSON.parse(row.from_json) : undefined,
    to_recipient: row.to_json ? JSON.parse(row.to_json) : undefined,
    is_read: Boolean(row.is_read),
    is_flag: Boolean(row.is_flag),
    is_draft: Boolean(row.is_draft),
    has_attachments: Boolean(row.has_attachments),
    thread_id: row.thread_id ?? undefined,
  };
}

export function registerIpcHandlers(
  auth: AuthService,
  db: MailDatabase,
  sync: SyncService,
  config: AppConfig,
  onUnreadChange: (count: number) => void
): void {
  ipcMain.handle("app:getConfig", () => ({
    configured: isConfigValid(config),
    redirectUri: config.redirectUri,
    apiBase: config.apiBase,
    webMailUrl: config.webMailUrl,
    cloudDocUrl: config.cloudDocUrl,
  }));

  ipcMain.handle("auth:status", async () => {
    const loggedIn = auth.isLoggedIn();
    let user = null;
    if (loggedIn) {
      try {
        user = await sync.api.getCurrentUser();
      } catch {
        /* ignore */
      }
    }
    return { loggedIn, user, profile: auth.getProfile() };
  });

  ipcMain.handle("auth:login", async () => {
    if (!isConfigValid(config)) {
      throw new Error(
        "请配置 WPS_CLIENT_ID 与 WPS_CLIENT_SECRET（见 .env.example）"
      );
    }
    await auth.login();
    const mailboxes = await sync.api.listMailboxes();
    const primary =
      mailboxes.items?.find((m) => m.is_primary) ?? mailboxes.items?.[0];
    if (primary) {
      db.setSyncState("primary_mailbox_id", primary.id);
      await sync.syncInboxQuick(primary.id);
      onUnreadChange(db.countUnreadInbox(primary.id));
    }
    return { ok: true };
  });

  ipcMain.handle("auth:logout", () => {
    auth.logout();
    onUnreadChange(0);
    return { ok: true };
  });

  ipcMain.handle("mail:listMailboxes", async () => {
    const data = await sync.api.listMailboxes();
    return data.items ?? [];
  });

  ipcMain.handle("mail:listFolders", async (_e, mailboxId: string) => {
    try {
      const data = await sync.api.listFolders(mailboxId);
      const items = data.items ?? [];
      for (const f of items) {
        if (f.folder_type === "user_folder" && f.unread_message_count == null) {
          f.unread_message_count = db.countUnreadFolder(
            mailboxId,
            f.folder_id
          );
        }
      }
      return items;
    } catch {
      return [];
    }
  });

  ipcMain.handle(
    "mail:listMessages",
    async (
      _e,
      payload: {
        mailboxId: string;
        folderId: string;
        refresh?: boolean;
        pageToken?: string;
      }
    ) => {
      const { mailboxId, folderId, refresh } = payload;

      if (refresh) {
        db.setFolderPageToken(mailboxId, folderId, null);
        await sync.syncFolderPage(mailboxId, folderId, { reset: true });
        if (folderId === "inbox") {
          onUnreadChange(db.countUnreadInbox(mailboxId));
        }
      } else if (!payload.pageToken) {
        const cached = db.listCached(mailboxId, folderId);
        if (cached.length > 0) {
          return {
            items: cached.map(rowToListItem),
            next_page_token: db.getFolderPageToken(mailboxId, folderId),
            fromCache: true,
          };
        }
        await sync.syncFolderPage(mailboxId, folderId, { reset: true });
      } else {
        await sync.syncFolderPage(mailboxId, folderId);
      }

      const cached = db.listCached(mailboxId, folderId);
      return {
        items: cached.map(rowToListItem),
        next_page_token: db.getFolderPageToken(mailboxId, folderId),
        fromCache: false,
      };
    }
  );

  ipcMain.handle(
    "mail:getMessage",
    async (
      _e,
      payload: { mailboxId: string; folderId: string; messageId: string }
    ) => {
      const row = db.getCachedRow(payload.mailboxId, payload.messageId);
      const apiFolderId = row?.folder_id ?? payload.folderId;
      const detail = await sync.api.getMessage(
        payload.mailboxId,
        apiFolderId,
        payload.messageId
      );
      if (detail.body) {
        db.cacheMessageBody(payload.mailboxId, payload.messageId, detail.body);
      }
      if (detail.is_read === false) {
        try {
          await sync.api.updateMessage(
            payload.mailboxId,
            apiFolderId,
            payload.messageId,
            { is_read: true }
          );
        } catch {
          /* 本地标记已读 */
        }
        db.setMessageRead(payload.mailboxId, payload.messageId, true);
        if (row?.sync_folder === "inbox") {
          onUnreadChange(db.countUnreadInbox(payload.mailboxId));
        }
      }
      return { ...detail, is_read: true };
    }
  );

  ipcMain.handle(
    "mail:search",
    async (
      _e,
      payload: {
        mailboxIds: string;
        keyword?: string;
        subject?: string;
        from?: string;
        body?: string;
        pageToken?: string;
      }
    ) => {
      const data = await sync.api.searchMessages({
        mailbox_ids: payload.mailboxIds,
        keyword: payload.keyword,
        subject: payload.subject,
        from: payload.from,
        body: payload.body,
        page_size: 10,
        page_token: payload.pageToken,
      });
      return {
        items: data.items ?? [],
        next_page_token: data.next_page_token,
      };
    }
  );

  ipcMain.handle("mail:getCloudDriveRoot", async () => {
    const drives = await sync.api.yundoc.listUserDrives("special");
    const drive = drives.items?.[0];
    if (!drive?.id) {
      throw new Error(
        "未找到「我的云文档」。请确认已开通 kso.drive.readwrite 并重新登录。"
      );
    }
    const data = await sync.api.yundoc.listFolderChildren(drive.id, "0");
    return {
      driveId: drive.id,
      driveName: drive.name,
      items: data.items.map((f) => ({
        driveId: f.drive_id,
        fileId: f.id,
        name: f.name,
        type: f.type,
        linkUrl: f.link_url,
        mtime: f.mtime,
      })),
      next_page_token: data.next_page_token,
    };
  });

  ipcMain.handle(
    "mail:listCloudLatest",
    async (_e, payload?: { pageToken?: string }) => {
      const data = await sync.api.yundoc.listLatestItems(30, payload?.pageToken);
      return {
        items: data.items.map((f) => ({
          driveId: f.drive_id,
          fileId: f.id,
          name: f.name,
          type: f.type,
          linkUrl: f.link_url,
          mtime: f.mtime,
        })),
        next_page_token: data.next_page_token,
      };
    }
  );

  ipcMain.handle(
    "mail:listCloudFolder",
    async (
      _e,
      payload: { driveId: string; parentId: string; pageToken?: string }
    ) => {
      const data = await sync.api.yundoc.listFolderChildren(
        payload.driveId,
        payload.parentId,
        { pageToken: payload.pageToken }
      );
      return {
        items: data.items.map((f) => ({
          driveId: f.drive_id,
          fileId: f.id,
          name: f.name,
          type: f.type,
          linkUrl: f.link_url,
          mtime: f.mtime,
        })),
        next_page_token: data.next_page_token,
      };
    }
  );

  ipcMain.handle(
    "mail:searchCloudDocs",
    async (_e, payload: { keyword: string; pageToken?: string }) => {
      const keyword = payload.keyword?.trim();
      if (!keyword) return { items: [], next_page_token: undefined };
      const data = await sync.api.yundoc.searchFiles(
        keyword,
        30,
        payload.pageToken
      );
      return {
        items: data.items.map((f) => ({
          driveId: f.drive_id,
          fileId: f.id,
          name: f.name,
          type: f.type,
          linkUrl: f.link_url,
          mtime: f.mtime,
        })),
        next_page_token: data.next_page_token,
      };
    }
  );

  ipcMain.handle(
    "mail:createCloudLinks",
    async (_e, selections: CloudDocSelection[]) => {
      if (!selections?.length) {
        return { items: [], errors: [] };
      }
      return createCloudLinksForSelections(sync.api, config, selections);
    }
  );

  ipcMain.handle("mail:openCloudDoc", () => {
    shell.openExternal(config.cloudDocUrl);
  });

  ipcMain.handle("mail:pickAttachments", async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ["openFile", "multiSelections"],
    });
    if (canceled || !filePaths?.length) {
      return { canceled: true, files: [] as { path: string; name: string }[] };
    }
    return {
      canceled: false,
      files: filePaths.map((p) => ({ path: p, name: path.basename(p) })),
    };
  });

  ipcMain.handle(
    "mail:processComposeFiles",
    async (_e, filePaths: string[]) => {
      if (!filePaths?.length) {
        return { files: [], errors: [], summary: "" };
      }
      return processComposeFiles(sync, config, filePaths, () =>
        auth.getAccessToken()
      );
    }
  );

  ipcMain.handle(
    "mail:send",
    async (
      _e,
      payload: {
        mailboxId: string;
        subject: string;
        body: string;
        isHtml?: boolean;
        to: string;
        cc?: string;
        bcc?: string;
        attachmentPaths?: string[];
      }
    ) => {
      const parseRecipients = (raw: string): MailRecipient[] =>
        raw
          .split(/[,;]/)
          .map((s) => s.trim())
          .filter(Boolean)
          .map((email_address) => ({ email_address, name: email_address }));

      let body = payload.body;
      let isHtml = Boolean(payload.isHtml);
      const allPaths = payload.attachmentPaths ?? [];
      const notes: string[] = [];

      let pathsToUpload: string[] = [];
      if (allPaths.length > 0) {
        const embedded = embedImagesInHtmlBody(body, isHtml, allPaths);
        if (embedded.embedded.length > 0) {
          body = embedded.body;
          isHtml = true;
          notes.push(
            `以下图片已嵌入正文：${embedded.embedded.join("、")}（开放平台暂无附件上传接口）。`
          );
        }
        pathsToUpload = embedded.remainingPaths;
      }

      if (config.mailSignature.trim()) {
        const sig = config.mailSignature.trim();
        body = isHtml
          ? `${body}<br><br>--<br>${sig}`
          : `${body}\n\n--\n${sig}`;
      }

      const bodyReq: CreateDraftBody = {
        subject: payload.subject,
        body,
        body_version: isHtml ? "v2" : "v1",
        to_recipients: parseRecipients(payload.to),
        cc_recipients: payload.cc ? parseRecipients(payload.cc) : undefined,
        bcc_recipients: payload.bcc ? parseRecipients(payload.bcc) : undefined,
      };

      const { message_id } = await sync.api.createDraft(
        payload.mailboxId,
        bodyReq
      );

      let attachmentWarning: string | undefined;
      if (pathsToUpload.length > 0) {
        const { uploaded, failed } = await uploadAttachmentsForMessage(
          sync.api,
          config,
          payload.mailboxId,
          message_id,
          pathsToUpload,
          () => auth.getAccessToken()
        );
        if (failed.length > 0) {
          const hint =
            "WPS OpenAPI 当前未提供邮件附件上传接口。请使用工具栏「在浏览器中打开」到 Web 邮箱添加 PDF/Word 等附件。";
          if (uploaded === 0) {
            throw new Error(
              `以下附件无法随信发送：${failed.join("、")}。${hint}` +
                (notes.length ? `\n\n${notes.join("\n")}` : "")
            );
          }
          notes.push(`以下附件未能上传：${failed.join("、")}。${hint}`);
        }
      }

      await sync.api.sendDraft(payload.mailboxId, message_id);
      if (notes.length) {
        attachmentWarning = notes.join("\n");
      }
      return { ok: true, message_id, attachmentWarning };
    }
  );

  ipcMain.handle(
    "mail:updateMessage",
    async (
      _e,
      payload: {
        mailboxId: string;
        folderId: string;
        messageId: string;
        isRead?: boolean;
        isFlag?: boolean;
      }
    ) => {
      const row = db.getCachedRow(payload.mailboxId, payload.messageId);
      const apiFolderId = row?.folder_id ?? payload.folderId;
      let apiOk = false;
      try {
        await sync.api.updateMessage(
          payload.mailboxId,
          apiFolderId,
          payload.messageId,
          {
            ...(payload.isRead !== undefined
              ? { is_read: payload.isRead }
              : {}),
            ...(payload.isFlag !== undefined
              ? { is_flag: payload.isFlag }
              : {}),
          }
        );
        apiOk = true;
      } catch {
        /* 本地仍更新，便于离线/未开放 API 时可用 */
      }
      if (payload.isRead !== undefined) {
        db.setMessageRead(
          payload.mailboxId,
          payload.messageId,
          payload.isRead
        );
      }
      if (
        payload.isRead !== undefined &&
        row?.sync_folder === "inbox"
      ) {
        onUnreadChange(db.countUnreadInbox(payload.mailboxId));
      }
      return { ok: true, apiOk };
    }
  );

  ipcMain.handle(
    "mail:deleteMessage",
    async (
      _e,
      payload: {
        mailboxId: string;
        folderId: string;
        messageId: string;
      }
    ) => {
      const row = db.getCachedRow(payload.mailboxId, payload.messageId);
      const apiFolderId = row?.folder_id ?? payload.folderId;
      let apiOk = false;
      try {
        await sync.api.deleteMessage(
          payload.mailboxId,
          apiFolderId,
          payload.messageId
        );
        apiOk = true;
      } catch {
        /* 见 updateMessage */
      }
      db.removeMessage(payload.mailboxId, payload.messageId);
      if (row?.sync_folder === "inbox") {
        onUnreadChange(db.countUnreadInbox(payload.mailboxId));
      }
      return { ok: true, apiOk };
    }
  );

  ipcMain.handle(
    "mail:moveMessage",
    async (
      _e,
      payload: {
        mailboxId: string;
        folderId: string;
        messageId: string;
        targetFolderId: string;
      }
    ) => {
      const row = db.getCachedRow(payload.mailboxId, payload.messageId);
      const apiFolderId = row?.folder_id ?? payload.folderId;
      const target = payload.targetFolderId;
      let apiOk = false;
      try {
        await sync.api.moveMessage(
          payload.mailboxId,
          apiFolderId,
          payload.messageId,
          { folder_id: target }
        );
        apiOk = true;
      } catch {
        /* 见 updateMessage */
      }
      db.moveMessageLocal(
        payload.mailboxId,
        payload.messageId,
        target,
        target
      );
      if (row?.sync_folder === "inbox" || target === "inbox") {
        onUnreadChange(db.countUnreadInbox(payload.mailboxId));
      }
      return { ok: true, apiOk };
    }
  );

  ipcMain.handle("mail:contactSuggestions", async (_e, mailboxId: string) => {
    const emails: string[] = [];
    try {
      const data = await sync.api.listMailContacts(50);
      for (const c of data.items ?? []) {
        const e = c.email_address?.trim();
        if (e) emails.push(e);
      }
    } catch {
      /* 应用授权 scope 未开通时使用缓存联系人 */
    }
    for (const e of db.recentRecipientEmails(mailboxId)) {
      if (!emails.includes(e)) emails.push(e);
    }
    return emails.slice(0, 50);
  });

  ipcMain.handle("mail:openWebMail", () => {
    shell.openExternal(config.webMailUrl);
  });

  ipcMain.handle(
    "mail:downloadAttachment",
    async (
      _e,
      payload: {
        mailboxId: string;
        messageId: string;
        attachmentId: string;
        filename: string;
      }
    ) => {
      const url = await sync.api.getAttachmentDownloadUrl(
        payload.mailboxId,
        payload.messageId,
        payload.attachmentId
      );
      const { filePath, canceled } = await dialog.showSaveDialog({
        defaultPath: payload.filename,
      });
      if (canceled || !filePath) return { canceled: true };

      const res = await fetch(url);
      const buf = Buffer.from(await res.arrayBuffer());
      const fs = await import("fs");
      fs.writeFileSync(filePath, buf);
      return { canceled: false, filePath };
    }
  );

  ipcMain.handle(
    "mail:executeQuarantineAction",
    async (
      _e,
      payload: {
        action: "pass" | "reject" | "detail";
        ruleId: string;
        isolateId?: string;
        apiPath?: string;
        detailPath?: string;
      }
    ) => {
      return executeQuarantineAction(config, () => auth.getAccessToken(), payload);
    }
  );

  ipcMain.handle("mail:openExternal", async (_e, url: string) => {
    const href = String(url ?? "").trim();
    if (!/^https?:\/\//i.test(href)) {
      throw new Error("仅支持 http/https 链接");
    }
    await shell.openExternal(href);
  });

  ipcMain.handle(
    "mail:pollInbox",
    async (_e, mailboxId: string) => {
      const prev = db.countUnreadInbox(mailboxId);
      db.setFolderPageToken(mailboxId, "inbox", null);
      await sync.syncFolderPage(mailboxId, "inbox", { reset: true });
      const next = db.countUnreadInbox(mailboxId);
      if (next > prev && Notification.isSupported()) {
        new Notification({
          title: "WPS Mail",
          body: `您有 ${next - prev} 封新邮件`,
        }).show();
      }
      onUnreadChange(next);
      return { unread: next };
    }
  );
}
