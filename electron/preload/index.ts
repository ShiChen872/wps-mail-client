import { contextBridge, ipcRenderer } from "electron";

export interface WpsMailApi {
  getConfig: () => Promise<{
    configured: boolean;
    redirectUri: string;
    apiBase: string;
    webMailUrl: string;
    cloudDocUrl: string;
  }>;
  authStatus: () => Promise<{
    loggedIn: boolean;
    user: unknown;
    profile: { expiresAt: number } | null;
  }>;
  login: () => Promise<{ ok: boolean }>;
  logout: () => Promise<{ ok: boolean }>;
  listMailboxes: () => Promise<unknown[]>;
  listFolders: (mailboxId: string) => Promise<unknown[]>;
  listMessages: (payload: {
    mailboxId: string;
    folderId: string;
    refresh?: boolean;
    pageToken?: string;
  }) => Promise<{
    items: unknown[];
    next_page_token?: string | null;
    fromCache?: boolean;
  }>;
  getMessage: (payload: {
    mailboxId: string;
    folderId: string;
    messageId: string;
  }) => Promise<unknown>;
  search: (payload: {
    mailboxIds: string;
    keyword?: string;
    subject?: string;
    from?: string;
    body?: string;
    pageToken?: string;
  }) => Promise<{ items: unknown[]; next_page_token?: string }>;
  pickAttachments: () => Promise<{
    canceled: boolean;
    files: { path: string; name: string }[];
  }>;
  processComposeFiles: (filePaths: string[]) => Promise<{
    files: { name: string; kind: "embedded" | "cloud"; html: string }[];
    errors: { name: string; message: string }[];
    summary: string;
  }>;
  getCloudDriveRoot: () => Promise<{
    driveId: string;
    driveName: string;
    items: {
      driveId: string;
      fileId: string;
      name: string;
      type: string;
      linkUrl?: string;
      mtime?: number;
    }[];
    next_page_token?: string;
  }>;
  listCloudLatest: (payload?: { pageToken?: string }) => Promise<{
    items: {
      driveId: string;
      fileId: string;
      name: string;
      type: string;
      linkUrl?: string;
      mtime?: number;
    }[];
    next_page_token?: string;
  }>;
  listCloudFolder: (payload: {
    driveId: string;
    parentId: string;
    pageToken?: string;
  }) => Promise<{
    items: {
      driveId: string;
      fileId: string;
      name: string;
      type: string;
      linkUrl?: string;
      mtime?: number;
    }[];
    next_page_token?: string;
  }>;
  searchCloudDocs: (payload: {
    keyword: string;
    pageToken?: string;
  }) => Promise<{
    items: {
      driveId: string;
      fileId: string;
      name: string;
      type: string;
      linkUrl?: string;
      mtime?: number;
    }[];
    next_page_token?: string;
  }>;
  createCloudLinks: (
    selections: {
      driveId: string;
      fileId: string;
      name: string;
      linkUrl?: string;
    }[]
  ) => Promise<{
    items: { name: string; url: string; html: string }[];
    errors: { name: string; message: string }[];
  }>;
  openCloudDoc: () => Promise<void>;
  send: (payload: {
    mailboxId: string;
    subject: string;
    body: string;
    isHtml?: boolean;
    to: string;
    cc?: string;
    bcc?: string;
    attachmentPaths?: string[];
  }) => Promise<{
    ok: boolean;
    message_id: string;
    attachmentWarning?: string;
  }>;
  saveDraft: (payload: {
    mailboxId: string;
    subject: string;
    body: string;
    isHtml?: boolean;
    to: string;
    cc?: string;
    bcc?: string;
    existingDraftMessageId?: string;
  }) => Promise<{ ok: boolean; message_id: string }>;
  updateMessage: (payload: {
    mailboxId: string;
    folderId: string;
    messageId: string;
    isRead?: boolean;
    isFlag?: boolean;
  }) => Promise<{ ok: boolean; apiOk: boolean }>;
  deleteMessage: (payload: {
    mailboxId: string;
    folderId: string;
    messageId: string;
  }) => Promise<{ ok: boolean; apiOk: boolean }>;
  moveMessage: (payload: {
    mailboxId: string;
    folderId: string;
    messageId: string;
    targetFolderId: string;
  }) => Promise<{ ok: boolean; apiOk: boolean }>;
  contactSuggestions: (mailboxId: string) => Promise<string[]>;
  downloadAttachment: (payload: {
    mailboxId: string;
    messageId: string;
    attachmentId: string;
    filename: string;
  }) => Promise<{ canceled: boolean; filePath?: string }>;
  openExternal: (url: string) => Promise<void>;
  executeQuarantineAction: (payload: {
    action: "pass" | "reject" | "detail";
    ruleId: string;
    isolateId?: string;
    apiPath?: string;
    detailPath?: string;
  }) => Promise<{ ok: boolean; message: string; needsWebMail?: boolean }>;
  openWebMail: () => Promise<void>;
  pollInbox: (mailboxId: string) => Promise<{ unread: number }>;
  onUnreadChanged: (cb: (count: number) => void) => () => void;
}

const api: WpsMailApi = {
  getConfig: () => ipcRenderer.invoke("app:getConfig"),
  authStatus: () => ipcRenderer.invoke("auth:status"),
  login: () => ipcRenderer.invoke("auth:login"),
  logout: () => ipcRenderer.invoke("auth:logout"),
  listMailboxes: () => ipcRenderer.invoke("mail:listMailboxes"),
  listFolders: (mailboxId) => ipcRenderer.invoke("mail:listFolders", mailboxId),
  listMessages: (payload) => ipcRenderer.invoke("mail:listMessages", payload),
  getMessage: (payload) => ipcRenderer.invoke("mail:getMessage", payload),
  search: (payload) => ipcRenderer.invoke("mail:search", payload),
  pickAttachments: () => ipcRenderer.invoke("mail:pickAttachments"),
  processComposeFiles: (filePaths) =>
    ipcRenderer.invoke("mail:processComposeFiles", filePaths),
  getCloudDriveRoot: () => ipcRenderer.invoke("mail:getCloudDriveRoot"),
  listCloudLatest: (payload) =>
    ipcRenderer.invoke("mail:listCloudLatest", payload),
  listCloudFolder: (payload) =>
    ipcRenderer.invoke("mail:listCloudFolder", payload),
  searchCloudDocs: (payload) =>
    ipcRenderer.invoke("mail:searchCloudDocs", payload),
  createCloudLinks: (selections) =>
    ipcRenderer.invoke("mail:createCloudLinks", selections),
  openCloudDoc: () => ipcRenderer.invoke("mail:openCloudDoc"),
  send: (payload) => ipcRenderer.invoke("mail:send", payload),
  saveDraft: (payload) => ipcRenderer.invoke("mail:saveDraft", payload),
  updateMessage: (payload) =>
    ipcRenderer.invoke("mail:updateMessage", payload),
  deleteMessage: (payload) =>
    ipcRenderer.invoke("mail:deleteMessage", payload),
  moveMessage: (payload) => ipcRenderer.invoke("mail:moveMessage", payload),
  contactSuggestions: (mailboxId) =>
    ipcRenderer.invoke("mail:contactSuggestions", mailboxId),
  downloadAttachment: (payload) =>
    ipcRenderer.invoke("mail:downloadAttachment", payload),
  openExternal: (url) => ipcRenderer.invoke("mail:openExternal", url),
  executeQuarantineAction: (payload) =>
    ipcRenderer.invoke("mail:executeQuarantineAction", payload),
  openWebMail: () => ipcRenderer.invoke("mail:openWebMail"),
  pollInbox: (mailboxId) => ipcRenderer.invoke("mail:pollInbox", mailboxId),
  onUnreadChanged: (cb) => {
    const handler = (_: unknown, count: number) => cb(count);
    ipcRenderer.on("mail:unreadChanged", handler);
    return () => ipcRenderer.removeListener("mail:unreadChanged", handler);
  },
};

contextBridge.exposeInMainWorld("wpsMail", api);
