import { WpsMailApiClient } from "@wps-mail/mail-api";
import type { AuthService } from "./auth-service";
import type { MailDatabase } from "./db";

const INBOX_SYNC_DAYS = 30;

export class SyncService {
  private client: WpsMailApiClient;

  constructor(
    auth: AuthService,
    private db: MailDatabase,
    apiBase: string
  ) {
    this.client = new WpsMailApiClient({
      baseUrl: apiBase,
      getAccessToken: () => auth.getAccessToken(),
    });
  }

  get api(): WpsMailApiClient {
    return this.client;
  }

  /** 增量同步：拉取一页并写入缓存，返回是否还有更多 */
  async syncFolderPage(
    mailboxId: string,
    folderId: string,
    options?: { reset?: boolean }
  ): Promise<{ items: number; nextPageToken?: string }> {
    if (options?.reset) {
      this.db.setFolderPageToken(mailboxId, folderId, null);
    }

    const pageToken = this.db.getFolderPageToken(mailboxId, folderId) ?? undefined;
    const startTime =
      folderId === "inbox"
        ? Math.floor(Date.now() / 1000) - INBOX_SYNC_DAYS * 86400
        : 1;

    const data = await this.client.listFolderMessages(mailboxId, folderId, {
      page_size: 10,
      page_token: pageToken,
      start_time: startTime,
    });

    if (data.items?.length) {
      this.db.upsertMessages(data.items, folderId);
    }

    this.db.setFolderPageToken(
      mailboxId,
      folderId,
      data.next_page_token ?? null
    );

    return {
      items: data.items?.length ?? 0,
      nextPageToken: data.next_page_token,
    };
  }

  /** 启动时快速同步收件箱（最多 5 页 × 10 条） */
  async syncInboxQuick(mailboxId: string): Promise<void> {
    this.db.setFolderPageToken(mailboxId, "inbox", null);
    for (let i = 0; i < 5; i++) {
      const { nextPageToken } = await this.syncFolderPage(mailboxId, "inbox");
      if (!nextPageToken) break;
    }
  }
}
