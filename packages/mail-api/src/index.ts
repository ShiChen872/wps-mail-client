export * from "./types.js";
export * from "./client.js";

export const SYSTEM_FOLDERS = [
  { id: "inbox", name: "收件箱" },
  { id: "drafts", name: "草稿" },
  { id: "sent", name: "已发送" },
  { id: "junk", name: "垃圾邮件" },
  { id: "trash", name: "已删除" },
] as const;

/** 文件夹邮件列表 API 实测上限为 10（>10 返回「请求参数取值无效」） */
export const MAX_FOLDER_MESSAGES_PAGE_SIZE = 10;

/** 搜索邮件 API 实测上限同为 10 */
export const MAX_SEARCH_MESSAGES_PAGE_SIZE = 10;

export const DEFAULT_MAIL_SCOPES = [
  "kso.user_base.read",
  "kso.mailbox.read",
  "kso.mail.read",
  "kso.mail.readwrite",
].join(",");
