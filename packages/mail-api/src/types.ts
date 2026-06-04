export interface WpsApiResponse<T> {
  code: number;
  msg: string;
  data: T;
}

export interface MailRecipient {
  avatar?: string;
  email_address: string;
  name?: string;
}

export interface Mailbox {
  id: string;
  email_address: string;
  name: string;
  is_primary: boolean;
}

export interface MailFolder {
  folder_id: string;
  folder_type: string;
  name: string;
  parent_folder_id?: string;
  total_message_count?: number;
  unread_message_count?: number;
}

export type SystemFolderId =
  | "inbox"
  | "drafts"
  | "sent"
  | "junk"
  | "trash";

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
  priority?: number;
}

export interface MailAttachment {
  filename: string;
  mime_type?: string;
  part_id: string;
  size?: number;
}

export interface MailDetail extends MailListItem {
  body?: string;
  body_version?: string;
  attachments?: MailAttachment[];
  thread_message_count?: number;
}

export interface Paginated<T> {
  items: T[];
  next_page_token?: string;
  total?: number;
}

export interface CreateDraftBody {
  subject?: string;
  body?: string;
  to_recipients?: MailRecipient[];
  cc_recipients?: MailRecipient[];
  bcc_recipients?: MailRecipient[];
}

export interface UpdateMessageBody {
  is_read?: boolean;
  is_flag?: boolean;
}

export interface MoveMessageBody {
  /** 目标目录 ID（系统夹可用 inbox/trash 等，自定义夹为数字 ID） */
  folder_id: string;
}

export interface MailContact {
  id: string;
  name?: string;
  email_address?: string;
}

export interface SearchMailParams {
  mailbox_ids: string;
  keyword?: string;
  subject?: string;
  from?: string;
  body?: string;
  filter?: ("unread" | "flagged")[];
  page_size?: number;
  page_token?: string;
  start_time?: number;
  end_time?: number;
}

export interface ListMessagesParams {
  page_size?: number;
  page_token?: string;
  start_time?: number;
  end_time?: number;
  filter?: ("unread" | "flagged")[];
  thread_id?: string;
}

export interface TokenSet {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  token_type: string;
}

export interface WpsUserInfo {
  id?: string;
  name?: string;
  avatar?: string;
  email?: string;
}
