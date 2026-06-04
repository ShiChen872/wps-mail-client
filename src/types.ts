export interface MailRecipient {
  email_address: string;
  name?: string;
  avatar?: string;
}

export interface MailListItem {
  message_id: string;
  mailbox_id: string;
  folder_id: string;
  subject: string;
  body_preview?: string;
  ctime: number;
  from?: MailRecipient;
  to_recipient?: MailRecipient[];
  cc_recipient?: MailRecipient[];
  bcc_recipient?: MailRecipient[];
  is_read: boolean;
  is_flag: boolean;
  is_draft: boolean;
  has_attachments: boolean;
  thread_id?: string;
  sender?: string;
}

export interface MailDetail extends MailListItem {
  body?: string;
  attachments?: {
    filename: string;
    part_id: string;
    mime_type?: string;
    size?: number;
  }[];
}

export interface Mailbox {
  id: string;
  email_address: string;
  name: string;
  is_primary: boolean;
}

export const SYSTEM_FOLDERS = [
  { id: "inbox", name: "收件箱" },
  { id: "drafts", name: "草稿" },
  { id: "sent", name: "已发送" },
  { id: "junk", name: "垃圾邮件" },
  { id: "trash", name: "已删除" },
] as const;

export interface MailFolderItem {
  folder_id: string;
  folder_type: string;
  name: string;
  parent_folder_id?: string;
  unread_message_count?: number;
}
