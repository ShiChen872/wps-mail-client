import type {
  CreateDraftBody,
  ListMessagesParams,
  MailContact,
  MailDetail,
  MailFolder,
  Mailbox,
  MailListItem,
  MoveMessageBody,
  Paginated,
  SearchMailParams,
  UpdateMessageBody,
  WpsApiResponse,
} from "./types.js";
import { WpsYundocApi } from "./yundoc.js";

/** 文件夹邮件列表 API 实测上限为 10 */
const MAX_FOLDER_MESSAGES_PAGE_SIZE = 10;
const MAX_SEARCH_MESSAGES_PAGE_SIZE = 10;

export interface WpsHttpOptions {
  baseUrl?: string;
  getAccessToken: () => Promise<string | null>;
}

export class WpsMailApiClient {
  private baseUrl: string;
  private getAccessToken: () => Promise<string | null>;

  constructor(options: WpsHttpOptions) {
    this.baseUrl = (options.baseUrl ?? "https://openapi.wps.cn").replace(
      /\/$/,
      ""
    );
    this.getAccessToken = options.getAccessToken;
  }

  private async request<T>(
    path: string,
    init?: RequestInit
  ): Promise<WpsApiResponse<T>> {
    const token = await this.getAccessToken();
    if (!token) {
      throw new Error("未登录，请先使用 WPS 账号授权");
    }

    const url = path.startsWith("http")
      ? path
      : `${this.baseUrl}${path.startsWith("/") ? "" : "/"}${path}`;

    const res = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(init?.headers as Record<string, string>),
      },
    });

    const text = await res.text();
    let json: WpsApiResponse<T>;
    try {
      json = text ? JSON.parse(text) : { code: -1, msg: "empty", data: {} as T };
    } catch {
      throw new Error(`WPS API 非 JSON (${res.status}): ${text.slice(0, 200)}`);
    }

    if (!res.ok || (json.code !== undefined && json.code !== 0)) {
      throw new Error(
        json.msg ?? `WPS API ${res.status}: ${text.slice(0, 200)}`
      );
    }

    return json;
  }

  /** 云文档 API（上传、分享链接） */
  get yundoc(): WpsYundocApi {
    return new WpsYundocApi((path, init) => this.request(path, init));
  }

  async listMailboxes(pageSize = 20, pageToken?: string) {
    const q = new URLSearchParams();
    if (pageSize) q.set("page_size", String(pageSize));
    if (pageToken) q.set("page_token", pageToken);
    const suffix = q.toString() ? `?${q}` : "";
    const res = await this.request<Paginated<Mailbox>>(`/v7/mailboxes${suffix}`);
    return res.data;
  }

  async listFolders(mailboxId: string, pageSize = 50, pageToken?: string) {
    const q = new URLSearchParams();
    if (pageSize) q.set("page_size", String(pageSize));
    if (pageToken) q.set("page_token", pageToken);
    const suffix = q.toString() ? `?${q}` : "";
    const res = await this.request<Paginated<MailFolder>>(
      `/v7/mailboxes/${encodeURIComponent(mailboxId)}/folders${suffix}`
    );
    return res.data;
  }

  /** 分页拉取全部目录（含子文件夹） */
  async listAllFolders(mailboxId: string): Promise<MailFolder[]> {
    const all: MailFolder[] = [];
    let pageToken: string | undefined;
    do {
      const page = await this.listFolders(mailboxId, 50, pageToken);
      if (page.items?.length) all.push(...page.items);
      pageToken = page.next_page_token?.trim() || undefined;
    } while (pageToken);
    return all;
  }

  async listSubFolders(
    mailboxId: string,
    folderId: string,
    pageSize = 50,
    pageToken?: string
  ) {
    const q = new URLSearchParams();
    if (pageSize) q.set("page_size", String(pageSize));
    if (pageToken) q.set("page_token", pageToken);
    const suffix = q.toString() ? `?${q}` : "";
    const res = await this.request<Paginated<MailFolder>>(
      `/v7/mailboxes/${encodeURIComponent(mailboxId)}/folders/${encodeURIComponent(folderId)}/children${suffix}`
    );
    return res.data;
  }

  async listFolderMessages(
    mailboxId: string,
    folderId: string,
    params: ListMessagesParams = {}
  ) {
    const q = new URLSearchParams();
    const pageSize = Math.min(
      params.page_size ?? MAX_FOLDER_MESSAGES_PAGE_SIZE,
      MAX_FOLDER_MESSAGES_PAGE_SIZE
    );
    q.set("page_size", String(pageSize));
    if (params.page_token) q.set("page_token", params.page_token);
    if (params.start_time) q.set("start_time", String(params.start_time));
    if (params.end_time) q.set("end_time", String(params.end_time));
    if (params.thread_id) q.set("thread_id", params.thread_id);
    if (params.filter?.length) {
      for (const f of params.filter) q.append("filter", f);
    }

    const res = await this.request<Paginated<MailListItem>>(
      `/v7/mailboxes/${encodeURIComponent(mailboxId)}/folders/${encodeURIComponent(folderId)}/messages?${q}`
    );
    return res.data;
  }

  async getMessage(
    mailboxId: string,
    folderId: string,
    messageId: string
  ) {
    const res = await this.request<MailDetail>(
      `/v7/mailboxes/${encodeURIComponent(mailboxId)}/folders/${encodeURIComponent(folderId)}/messages/${encodeURIComponent(messageId)}`
    );
    return res.data;
  }

  async searchMessages(params: SearchMailParams) {
    const q = new URLSearchParams();
    q.set("mailbox_ids", params.mailbox_ids);
    if (params.keyword) q.set("keyword", params.keyword);
    if (params.subject) q.set("subject", params.subject);
    if (params.from) q.set("from", params.from);
    if (params.body) q.set("body", params.body);
    if (params.page_size)
      q.set(
        "page_size",
        String(
          Math.min(params.page_size, MAX_SEARCH_MESSAGES_PAGE_SIZE)
        )
      );
    else q.set("page_size", String(MAX_SEARCH_MESSAGES_PAGE_SIZE));
    if (params.page_token) q.set("page_token", params.page_token);
    if (params.start_time) q.set("start_time", String(params.start_time));
    if (params.end_time) q.set("end_time", String(params.end_time));
    if (params.filter?.length) q.set("filter", params.filter.join(","));

    const res = await this.request<Paginated<MailListItem>>(
      `/v7/mail_messages/search?${q}`
    );
    return res.data;
  }

  async createDraft(mailboxId: string, body: CreateDraftBody) {
    const res = await this.request<{ message_id: string }>(
      `/v7/mailboxes/${encodeURIComponent(mailboxId)}/messages/create`,
      { method: "POST", body: JSON.stringify(body) }
    );
    return res.data;
  }

  async sendDraft(mailboxId: string, messageId: string) {
    await this.request<Record<string, never>>(
      `/v7/mailboxes/${encodeURIComponent(mailboxId)}/messages/${encodeURIComponent(messageId)}/send`,
      { method: "POST", body: JSON.stringify({}) }
    );
  }

  /**
   * 为草稿邮件上传附件（创建草稿后调用）。
   * 官方 scrape 文档仅含 download_url；此处按常见 REST 约定依次尝试。
   */
  async uploadMessageAttachment(
    mailboxId: string,
    messageId: string,
    file: { filename: string; mimeType: string; data: Buffer }
  ): Promise<void> {
    const b64 = file.data.toString("base64");
    const base = `/v7/mailboxes/${encodeURIComponent(mailboxId)}/messages/${encodeURIComponent(messageId)}`;
    const jsonAttempts: Array<{ path: string; body: Record<string, string> }> = [
      {
        path: `${base}/attachments/create`,
        body: {
          filename: file.filename,
          mime_type: file.mimeType,
          content: b64,
        },
      },
      {
        path: `${base}/attachments/create`,
        body: {
          filename: file.filename,
          mime_type: file.mimeType,
          content_base64: b64,
        },
      },
      {
        path: `${base}/attachments/upload`,
        body: {
          filename: file.filename,
          mime_type: file.mimeType,
          file: b64,
        },
      },
      {
        path: `${base}/attachments`,
        body: {
          filename: file.filename,
          mime_type: file.mimeType,
          content_base64: b64,
        },
      },
    ];

    let lastError: Error | null = null;
    for (const { path, body } of jsonAttempts) {
      try {
        await this.request<{ part_id?: string; attachment_id?: string }>(path, {
          method: "POST",
          body: JSON.stringify(body),
        });
        return;
      } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e));
      }
    }

    throw (
      lastError ??
      new Error(
        "附件上传失败：开放平台未返回成功。请在 API Explorer 确认邮件附件上传接口，或暂用 Web 邮箱发送附件。"
      )
    );
  }

  async getAttachmentDownloadUrl(
    mailboxId: string,
    messageId: string,
    attachmentId: string
  ) {
    const res = await this.request<{ download_url: string }>(
      `/v7/mailboxes/${encodeURIComponent(mailboxId)}/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}/download_url`
    );
    return res.data.download_url;
  }

  /**
   * 更新邮件状态（已读/旗标等）。
   * 路径以开放平台常见约定为准；若返回错误请用 Web 邮箱或待 API 文档补充。
   */
  async updateMessage(
    mailboxId: string,
    folderId: string,
    messageId: string,
    body: UpdateMessageBody
  ) {
    await this.request<Record<string, never>>(
      `/v7/mailboxes/${encodeURIComponent(mailboxId)}/folders/${encodeURIComponent(folderId)}/messages/${encodeURIComponent(messageId)}/update`,
      { method: "POST", body: JSON.stringify(body) }
    );
  }

  async deleteMessage(
    mailboxId: string,
    folderId: string,
    messageId: string
  ) {
    await this.request<Record<string, never>>(
      `/v7/mailboxes/${encodeURIComponent(mailboxId)}/folders/${encodeURIComponent(folderId)}/messages/${encodeURIComponent(messageId)}/delete`,
      { method: "POST", body: JSON.stringify({}) }
    );
  }

  async moveMessage(
    mailboxId: string,
    folderId: string,
    messageId: string,
    body: MoveMessageBody
  ) {
    await this.request<Record<string, never>>(
      `/v7/mailboxes/${encodeURIComponent(mailboxId)}/folders/${encodeURIComponent(folderId)}/messages/${encodeURIComponent(messageId)}/move`,
      { method: "POST", body: JSON.stringify(body) }
    );
  }

  /** 企业邮箱联系人（需应用授权 scope，用户 token 可能不可用） */
  async listMailContacts(pageSize = 50, pageToken?: string) {
    const q = new URLSearchParams();
    q.set("page_size", String(pageSize));
    if (pageToken) q.set("page_token", pageToken);
    const res = await this.request<Paginated<MailContact>>(
      `/v7/mail_contacts?${q}`
    );
    return res.data;
  }

  /** 获取当前用户（需 kso.user_base.read） */
  async getCurrentUser() {
    const res = await this.request<{
      id: string;
      user_name?: string;
      avatar?: string;
      email?: string;
    }>("/v7/users/current");
    return res.data;
  }
}
