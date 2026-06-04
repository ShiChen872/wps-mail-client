import { useCallback, useEffect, useMemo, useState } from "react";
import type { ComposeDraft } from "./lib/compose";
import { buildForwardDraft, buildReplyDraft } from "./lib/compose";
import type {
  MailDetail,
  MailFolderItem,
  MailListItem,
  Mailbox,
  MailRecipient,
} from "./types";
import { SYSTEM_FOLDERS } from "./types";
import { ComposeModal } from "./components/ComposeModal";

function formatTime(ts: number): string {
  if (!ts) return "";
  const d = new Date(ts * 1000);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
}

function senderLabel(m: MailListItem): string {
  return m.from?.name || m.from?.email_address || m.sender || "(未知发件人)";
}

function formatRecipients(list?: MailRecipient[]): string {
  if (!list?.length) return "（无）";
  return list
    .map((r) =>
      r.name && r.email_address && r.name !== r.email_address
        ? `${r.name} <${r.email_address}>`
        : r.email_address || r.name || "?"
    )
    .join("；");
}

function listRowPeerLabel(m: MailListItem, folderId: string): string {
  if (folderId === "sent" || folderId === "drafts") {
    const to = formatRecipients(m.to_recipient);
    return to === "（无）" ? senderLabel(m) : to;
  }
  return senderLabel(m);
}

export default function App() {
  const [configured, setConfigured] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);
  const [userName, setUserName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [mailboxId, setMailboxId] = useState("");
  const [folderId, setFolderId] = useState("inbox");
  const [customFolders, setCustomFolders] = useState<MailFolderItem[]>([]);
  const [folderUnread, setFolderUnread] = useState<Record<string, number>>({});
  const [messages, setMessages] = useState<MailListItem[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<MailDetail | null>(null);
  const [searchQ, setSearchQ] = useState("");
  const [searchSubject, setSearchSubject] = useState("");
  const [searchFrom, setSearchFrom] = useState("");
  const [searchBody, setSearchBody] = useState("");
  const [searchMode, setSearchMode] = useState(false);
  const [advancedSearch, setAdvancedSearch] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeDraft, setComposeDraft] = useState<ComposeDraft | undefined>();
  const [contacts, setContacts] = useState<string[]>([]);
  const [inboxUnread, setInboxUnread] = useState(0);

  const activeFolderId = searchMode ? "" : folderId;

  const selected = useMemo(
    () => messages.find((m) => m.message_id === selectedId) ?? null,
    [messages, selectedId]
  );

  const refreshAuth = useCallback(async () => {
    const cfg = await window.wpsMail.getConfig();
    setConfigured(cfg.configured);
    const st = await window.wpsMail.authStatus();
    setLoggedIn(st.loggedIn);
    const u = st.user as { user_name?: string; name?: string } | null;
    setUserName(u?.user_name ?? u?.name ?? "");
  }, []);

  const loadMailboxes = useCallback(async () => {
    const list = (await window.wpsMail.listMailboxes()) as Mailbox[];
    setMailboxes(list);
    const primary = list.find((m) => m.is_primary) ?? list[0];
    if (primary) {
      setMailboxId((prev) => prev || primary.id);
      return primary.id;
    }
    return "";
  }, []);

  const loadFolders = useCallback(async (mbId: string) => {
    const items = (await window.wpsMail.listFolders(mbId)) as MailFolderItem[];
    const custom = items.filter((f) => f.folder_type === "user_folder");
    setCustomFolders(custom);
    const unread: Record<string, number> = { inbox: 0 };
    for (const f of SYSTEM_FOLDERS) {
      unread[f.id] = 0;
    }
    for (const f of items) {
      if (f.unread_message_count != null) {
        unread[f.folder_id] = f.unread_message_count;
      }
    }
    setFolderUnread(unread);
  }, []);

  const loadContacts = useCallback(async (mbId: string) => {
    try {
      const list = await window.wpsMail.contactSuggestions(mbId);
      setContacts(list);
    } catch {
      setContacts([]);
    }
  }, []);

  const loadMessages = useCallback(
    async (opts?: {
      refresh?: boolean;
      append?: boolean;
      pageToken?: string | null;
    }) => {
      if (!mailboxId) return;
      setLoading(true);
      setError(null);
      try {
        if (searchMode) {
          const hasQuery =
            searchQ.trim() ||
            searchSubject.trim() ||
            searchFrom.trim() ||
            searchBody.trim();
          if (!hasQuery) {
            setMessages([]);
            setNextPageToken(null);
            return;
          }
          const res = await window.wpsMail.search({
            mailboxIds: mailboxId,
            keyword: searchQ.trim() || undefined,
            subject: searchSubject.trim() || undefined,
            from: searchFrom.trim() || undefined,
            body: searchBody.trim() || undefined,
            pageToken: opts?.append ? opts.pageToken ?? undefined : undefined,
          });
          const items = res.items as MailListItem[];
          setMessages((prev) =>
            opts?.append ? [...prev, ...items] : items
          );
          setNextPageToken(res.next_page_token ?? null);
        } else {
          const res = await window.wpsMail.listMessages({
            mailboxId,
            folderId,
            refresh: opts?.refresh,
            pageToken: opts?.append ? opts.pageToken ?? undefined : undefined,
          });
          const items = res.items as MailListItem[];
          setMessages((prev) =>
            opts?.append ? [...prev, ...items] : items
          );
          setNextPageToken(res.next_page_token ?? null);
          if (folderId === "inbox") {
            const unread = items.filter((m) => !m.is_read).length;
            setInboxUnread(unread);
          }
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    },
    [mailboxId, folderId, searchMode, searchQ, searchSubject, searchFrom, searchBody]
  );

  const loadDetail = useCallback(async (m: MailListItem) => {
    setSelectedId(m.message_id);
    setDetail(null);
    try {
      const d = (await window.wpsMail.getMessage({
        mailboxId: m.mailbox_id,
        folderId: m.folder_id,
        messageId: m.message_id,
      })) as MailDetail;
      setDetail(d);
      if (!d.is_read) {
        setMessages((prev) =>
          prev.map((row) =>
            row.message_id === m.message_id ? { ...row, is_read: true } : row
          )
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void refreshAuth();
  }, [refreshAuth]);

  useEffect(() => {
    if (!loggedIn) return;
    void loadMailboxes();
  }, [loggedIn, loadMailboxes]);

  useEffect(() => {
    if (!loggedIn || !mailboxId) return;
    void loadFolders(mailboxId);
    void loadContacts(mailboxId);
  }, [loggedIn, mailboxId, loadFolders, loadContacts]);

  useEffect(() => {
    if (!loggedIn || !mailboxId) return;
    setNextPageToken(null);
    void loadMessages({ refresh: !searchMode });
  }, [folderId, mailboxId, loggedIn, searchMode]);

  useEffect(() => {
    const unsub = window.wpsMail.onUnreadChanged((count) => {
      setInboxUnread(count);
      void loadMessages({ refresh: true });
    });
    return unsub;
  }, [loadMessages]);

  const handleLogin = async () => {
    setError(null);
    try {
      await window.wpsMail.login();
      await refreshAuth();
      await loadMailboxes();
      await loadMessages({ refresh: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleLogout = async () => {
    await window.wpsMail.logout();
    setLoggedIn(false);
    setMessages([]);
    setDetail(null);
    setMailboxes([]);
  };

  const handleSearch = () => {
    const hasQuery =
      searchQ.trim() ||
      searchSubject.trim() ||
      searchFrom.trim() ||
      searchBody.trim();
    setSearchMode(hasQuery);
    setNextPageToken(null);
    void loadMessages({ refresh: true });
  };

  const clearSearch = () => {
    setSearchMode(false);
    setSearchQ("");
    setSearchSubject("");
    setSearchFrom("");
    setSearchBody("");
    setNextPageToken(null);
  };

  const openCompose = (draft?: ComposeDraft) => {
    setComposeDraft(draft);
    setComposeOpen(true);
  };

  const runMessageAction = async (
    action: () => Promise<{ apiOk: boolean }>,
    onSuccess: () => void
  ) => {
    try {
      const res = await action();
      if (!res.apiOk) {
        setError(
          "操作已更新本地列表；若 Web 邮箱未同步，请使用「在浏览器中打开」确认。"
        );
      }
      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleDelete = () => {
    if (!selected) return;
    void runMessageAction(
      () =>
        window.wpsMail.deleteMessage({
          mailboxId: selected.mailbox_id,
          folderId: selected.folder_id,
          messageId: selected.message_id,
        }),
      () => {
        setMessages((prev) =>
          prev.filter((m) => m.message_id !== selected.message_id)
        );
        setDetail(null);
        setSelectedId(null);
      }
    );
  };

  const handleMove = (targetFolderId: string) => {
    if (!selected) return;
    void runMessageAction(
      () =>
        window.wpsMail.moveMessage({
          mailboxId: selected.mailbox_id,
          folderId: selected.folder_id,
          messageId: selected.message_id,
          targetFolderId,
        }),
      () => {
        setMessages((prev) =>
          prev.filter((m) => m.message_id !== selected.message_id)
        );
        setDetail(null);
        setSelectedId(null);
      }
    );
  };

  const handleToggleRead = (isRead: boolean) => {
    if (!selected) return;
    void runMessageAction(
      () =>
        window.wpsMail.updateMessage({
          mailboxId: selected.mailbox_id,
          folderId: selected.folder_id,
          messageId: selected.message_id,
          isRead,
        }),
      () => {
        setMessages((prev) =>
          prev.map((m) =>
            m.message_id === selected.message_id ? { ...m, is_read: isRead } : m
          )
        );
        setDetail((d) => (d ? { ...d, is_read: isRead } : d));
      }
    );
  };

  const folderBadge = (id: string) => {
    const n = folderUnread[id];
    return n > 0 ? ` (${n})` : "";
  };

  const bodyHtml = detail?.body ?? detail?.body_preview ?? "";

  if (!loggedIn) {
    return (
      <div className="app-shell">
        <header className="app-toolbar">
          <h1>WPS Mail</h1>
        </header>
        <div className="login-screen">
          <h2>登录 WPS 365 邮箱</h2>
          <p>
            使用企业自建应用 OAuth 登录，无需配置 IMAP/SMTP。请在项目根目录配置{" "}
            <code>.env</code> 中的 <code>WPS_CLIENT_ID</code> 与{" "}
            <code>WPS_CLIENT_SECRET</code>，并在开放平台将回调地址设为{" "}
            <code>http://127.0.0.1:38473/callback</code>。
          </p>
          {!configured && (
            <p style={{ color: "#cf1322" }}>
              当前未检测到客户端凭证，请参考 .env.example 配置后重启应用。
            </p>
          )}
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void handleLogin()}
            disabled={!configured}
          >
            使用 WPS 账号登录
          </button>
          {error && <p style={{ color: "#cf1322" }}>{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      {error && (
        <div className="error-banner">
          {error}
          <button type="button" className="btn-link" onClick={() => setError(null)}>
            关闭
          </button>
        </div>
      )}
      <header className="app-toolbar">
        <h1>WPS Mail</h1>
        <span className="user">{userName || "已登录"}</span>
        {mailboxes.length > 1 && (
          <select
            value={mailboxId}
            onChange={(e) => setMailboxId(e.target.value)}
            aria-label="邮箱账号"
          >
            {mailboxes.map((m) => (
              <option key={m.id} value={m.id}>
                {m.email_address}
              </option>
            ))}
          </select>
        )}
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => openCompose()}
        >
          写邮件
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => void window.wpsMail.openWebMail()}
        >
          在浏览器中打开
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => void loadMessages({ refresh: true })}
          disabled={loading}
        >
          刷新
        </button>
        <button type="button" className="btn" onClick={() => void handleLogout()}>
          退出
        </button>
      </header>

      <div className="app-main">
        <nav className="sidebar" aria-label="文件夹">
          <div className="sidebar-section">系统文件夹</div>
          {SYSTEM_FOLDERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={
                activeFolderId === f.id && !searchMode ? "active" : ""
              }
              onClick={() => {
                clearSearch();
                setFolderId(f.id);
              }}
            >
              {f.name}
              {f.id === "inbox"
                ? folderBadge("inbox") ||
                  (inboxUnread > 0 ? ` (${inboxUnread})` : "")
                : folderBadge(f.id)}
            </button>
          ))}
          {customFolders.length > 0 && (
            <>
              <div className="sidebar-section">自定义文件夹</div>
              {customFolders.map((f) => (
                <button
                  key={f.folder_id}
                  type="button"
                  className={
                    activeFolderId === f.folder_id && !searchMode
                      ? "active"
                      : ""
                  }
                  onClick={() => {
                    clearSearch();
                    setFolderId(f.folder_id);
                  }}
                >
                  {f.name}
                  {folderBadge(f.folder_id)}
                </button>
              ))}
            </>
          )}
        </nav>

        <section className="mail-list">
          <div className="list-toolbar">
            <input
              placeholder="关键字搜索…"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
            <button type="button" className="btn" onClick={handleSearch}>
              搜索
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => setAdvancedSearch((v) => !v)}
            >
              {advancedSearch ? "收起" : "高级"}
            </button>
            {searchMode && (
              <button type="button" className="btn" onClick={clearSearch}>
                清除
              </button>
            )}
          </div>
          {advancedSearch && (
            <div className="advanced-search">
              <input
                placeholder="主题"
                value={searchSubject}
                onChange={(e) => setSearchSubject(e.target.value)}
              />
              <input
                placeholder="发件人"
                value={searchFrom}
                onChange={(e) => setSearchFrom(e.target.value)}
              />
              <input
                placeholder="正文"
                value={searchBody}
                onChange={(e) => setSearchBody(e.target.value)}
              />
            </div>
          )}
          <div className="list-scroll">
            {loading && messages.length === 0 && (
              <p style={{ padding: 16, color: "var(--muted)" }}>加载中…</p>
            )}
            {!loading && messages.length === 0 && (
              <p style={{ padding: 16, color: "var(--muted)" }}>暂无邮件</p>
            )}
            {messages.map((m) => (
              <div
                key={m.message_id}
                role="button"
                tabIndex={0}
                className={`mail-row ${!m.is_read ? "unread" : ""} ${selectedId === m.message_id ? "selected" : ""}`}
                onClick={() => void loadDetail(m)}
                onKeyDown={(e) => e.key === "Enter" && void loadDetail(m)}
              >
                <div className="subject">{m.subject || "(无主题)"}</div>
                <div className="meta">
                  <span>
                    {listRowPeerLabel(
                      m,
                      searchMode ? m.folder_id : folderId
                    )}
                  </span>
                  <span>{formatTime(m.ctime)}</span>
                </div>
              </div>
            ))}
            {nextPageToken && (
              <div className="list-footer">
                <button
                  type="button"
                  className="btn"
                  disabled={loading}
                  onClick={() =>
                    void loadMessages({ append: true, pageToken: nextPageToken })
                  }
                >
                  加载更多
                </button>
              </div>
            )}
          </div>
        </section>

        <section className="reader">
          {!selected && <div className="reader-empty">选择一封邮件以阅读</div>}
          {selected && (
            <>
              <div className="reader-actions">
                <button
                  type="button"
                  className="btn"
                  disabled={!detail}
                  onClick={() =>
                    detail && openCompose(buildReplyDraft(detail, false))
                  }
                >
                  回复
                </button>
                <button
                  type="button"
                  className="btn"
                  disabled={!detail}
                  onClick={() =>
                    detail && openCompose(buildReplyDraft(detail, true))
                  }
                >
                  全部回复
                </button>
                <button
                  type="button"
                  className="btn"
                  disabled={!detail}
                  onClick={() =>
                    detail && openCompose(buildForwardDraft(detail))
                  }
                >
                  转发
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => handleToggleRead(!selected.is_read)}
                >
                  {selected.is_read ? "标为未读" : "标为已读"}
                </button>
                <button type="button" className="btn" onClick={handleDelete}>
                  删除
                </button>
                <select
                  aria-label="移动到"
                  defaultValue=""
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v) {
                      handleMove(v);
                      e.target.value = "";
                    }
                  }}
                >
                  <option value="">移动到…</option>
                  {SYSTEM_FOLDERS.filter((f) => f.id !== folderId).map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                  {customFolders.map((f) => (
                    <option key={f.folder_id} value={f.folder_id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
              <header className="reader-header">
                <h2>{detail?.subject || selected.subject || "(无主题)"}</h2>
                <div className="reader-meta">
                  <div>发件人：{senderLabel(detail ?? selected)}</div>
                  <div>
                    收件人：
                    {formatRecipients(
                      detail?.to_recipient ?? selected.to_recipient
                    )}
                  </div>
                  {(detail?.cc_recipient ?? selected.cc_recipient)?.length ? (
                    <div>
                      抄送：
                      {formatRecipients(
                        detail?.cc_recipient ?? selected.cc_recipient
                      )}
                    </div>
                  ) : null}
                  <div>
                    时间：
                    {formatTime(detail?.ctime ?? selected.ctime)}
                  </div>
                  {(folderId === "sent" || folderId === "drafts") && (
                    <div className="reader-hint">
                      此邮件在「
                      {SYSTEM_FOLDERS.find((f) => f.id === folderId)?.name ??
                        "当前文件夹"}
                      」。您本人收信请查看「收件箱」。
                    </div>
                  )}
                </div>
              </header>
              {detail?.attachments && detail.attachments.length > 0 && (
                <div className="attachments">
                  {detail.attachments.map((a) => (
                    <button
                      key={a.part_id}
                      type="button"
                      className="btn"
                      onClick={() =>
                        void window.wpsMail.downloadAttachment({
                          mailboxId: selected.mailbox_id,
                          messageId: selected.message_id,
                          attachmentId: a.part_id,
                          filename: a.filename,
                        })
                      }
                    >
                      {a.filename}
                    </button>
                  ))}
                </div>
              )}
              <div className="reader-body">
                {bodyHtml.includes("<") ? (
                  <iframe title="邮件正文" sandbox="" srcDoc={bodyHtml} />
                ) : (
                  <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit" }}>
                    {bodyHtml}
                  </pre>
                )}
              </div>
            </>
          )}
        </section>
      </div>

      {composeOpen && mailboxId && (
        <ComposeModal
          mailboxId={mailboxId}
          initial={composeDraft}
          contactSuggestions={contacts}
          onClose={() => {
            setComposeOpen(false);
            setComposeDraft(undefined);
          }}
          onSent={() => {
            setComposeOpen(false);
            setComposeDraft(undefined);
            setFolderId("sent");
            clearSearch();
            void loadMessages({ refresh: true });
          }}
        />
      )}
    </div>
  );
}
