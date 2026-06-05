import { contextBridge, ipcRenderer } from "electron";

export interface WpsMailApi {
  getConfig: () => Promise<{
    configured: boolean;
    redirectUri: string;
    apiBase: string;
    webMailUrl: string;
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
  uploadCloudLinks: (filePaths: string[]) => Promise<{
    items: { name: string; url: string; html: string }[];
    errors: { name: string; message: string }[];
  }>;
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
  uploadCloudLinks: (filePaths) =>
    ipcRenderer.invoke("mail:uploadCloudLinks", filePaths),
  send: (payload) => ipcRenderer.invoke("mail:send", payload),
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
  openWebMail: () => ipcRenderer.invoke("mail:openWebMail"),
  pollInbox: (mailboxId) => ipcRenderer.invoke("mail:pollInbox", mailboxId),
  onUnreadChanged: (cb) => {
    const handler = (_: unknown, count: number) => cb(count);
    ipcRenderer.on("mail:unreadChanged", handler);
    return () => ipcRenderer.removeListener("mail:unreadChanged", handler);
  },
};

contextBridge.exposeInMainWorld("wpsMail", api);
