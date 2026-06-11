import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ComposeDraft } from "./lib/compose";
import { buildEditDraftFromMail, buildForwardDraft, buildReplyDraft } from "./lib/compose";
import type {
  MailDetail,
  MailFolderItem,
  MailListItem,
  Mailbox,
  MailRecipient,
} from "./types";
import { SYSTEM_FOLDERS } from "./types";
import { ComposeModal } from "./components/ComposeModal";
import { MailBodyReader } from "./components/MailBodyReader";
import { ThreadListItem } from "./components/ThreadListItem";
import { ShortcutsHelpModal } from "./components/ShortcutsHelpModal";
import { FolderTreeNav } from "./components/FolderTreeNav";
import {
  buildFolderTree,
  flattenFolderTreeForSelect,
  folderAncestorIds,
} from "./lib/folder-tree";
import { mailboxOptionLabel } from "./lib/mailbox";
import { useTheme } from "./hooks/useTheme";
import { useMailShortcuts } from "./hooks/useMailShortcuts";
import {
  groupByThread,
  threadMessagesForItem,
} from "./lib/threads";

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
  const [allFolders, setAllFolders] = useState<MailFolderItem[]>([]);
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(
    () => new Set()
  );
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
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(
    () => new Set()
  );
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { themeLabel, cycleTheme } = useTheme();

  const activeFolderId = searchMode ? "" : folderId;

  const folderTree = useMemo(
    () => buildFolderTree(allFolders),
    [allFolders]
  );

  const customMoveOptions = useMemo(
    () => flattenFolderTreeForSelect(folderTree),
    [folderTree]
  );

  const selected = useMemo(
    () => messages.find((m) => m.message_id === selectedId) ?? null,
    [messages, selectedId]
  );

  const threadGroups = useMemo(
    () => (searchMode ? null : groupByThread(messages)),
    [messages, searchMode]
  );

  const selectedThreadMessages = useMemo(() => {
    if (!selected || searchMode) return [];
    return threadMessagesForItem(messages, selected);
  }, [selected, messages, searchMode]);

  const selectedThreadIndex = useMemo(() => {
    if (!selectedId || !selectedThreadMessages.length) return -1;
    return selectedThreadMessages.findIndex(
      (m) => m.message_id === selectedId
    );
  }, [selectedId, selectedThreadMessages]);

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
    setAllFolders(items);
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

  const decrementFolderUnread = useCallback((syncFolderId: string) => {
    setFolderUnread((prev) => ({
      ...prev,
      [syncFolderId]: Math.max(0, (prev[syncFolderId] ?? 0) - 1),
    }));
    if (syncFolderId === "inbox") {
      setInboxUnread((n) => Math.max(0, n - 1));
    }
  }, []);

  const loadDetail = useCallback(
    async (m: MailListItem) => {
      setSelectedId(m.message_id);
      setDetail(null);
      if (!m.is_read) {
        setMessages((prev) =>
          prev.map((row) =>
            row.message_id === m.message_id ? { ...row, is_read: true } : row
          )
        );
        if (!searchMode) {
          decrementFolderUnread(folderId);
        }
      }
      try {
        const d = (await window.wpsMail.getMessage({
          mailboxId: m.mailbox_id,
          folderId: m.folder_id,
          messageId: m.message_id,
        })) as MailDetail;
        setDetail({ ...d, is_read: true });
        setMessages((prev) =>
          prev.map((row) =>
            row.message_id === m.message_id ? { ...row, is_read: true } : row
          )
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [decrementFolderUnread, folderId, searchMode]
  );

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
    setExpandedThreads(new Set());
    void loadMessages({ refresh: !searchMode });
  }, [folderId, mailboxId, loggedIn, searchMode]);

  useEffect(() => {
    if (SYSTEM_FOLDERS.some((f) => f.id === folderId)) return;
    const ancestors = folderAncestorIds(allFolders, folderId);
    if (!ancestors.length) return;
    setExpandedFolderIds((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (const id of ancestors) {
        if (!next.has(id)) {
          next.add(id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [folderId, allFolders]);

  const toggleFolderExpand = (id: string) => {
    setExpandedFolderIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectFolder = (id: string) => {
    clearSearch();
    setFolderId(id);
  };

  useEffect(() => {
    if (!selected?.thread_id || !threadGroups) return;
    const key = selected.thread_id.trim();
    const group = threadGroups.find((g) => g.threadKey === key);
    if (!group || group.items.length <= 1) return;
    setExpandedThreads((prev) => {
      if (prev.has(key)) return prev;
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  }, [selected?.message_id, selected?.thread_id, threadGroups]);

  useEffect(() => {
    const unsub = window.wpsMail.onUnreadChanged((count) => {
      setInboxUnread(count);
      setFolderUnread((prev) => ({ ...prev, inbox: count }));
    });
    return unsub;
  }, []);

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

  const toggleThreadExpand = (threadKey: string) => {
    setExpandedThreads((prev) => {
      const next = new Set(prev);
      if (next.has(threadKey)) next.delete(threadKey);
      else next.add(threadKey);
      return next;
    });
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
        const syncFolder = searchMode ? selected.folder_id : folderId;
        if (isRead) {
          decrementFolderUnread(syncFolder);
        } else {
          setFolderUnread((prev) => ({
            ...prev,
            [syncFolder]: (prev[syncFolder] ?? 0) + 1,
          }));
          if (syncFolder === "inbox") {
            setInboxUnread((n) => n + 1);
          }
        }
      }
    );
  };

  useMailShortcuts(
    {
      enabled: loggedIn && !shortcutsOpen,
      onNewMail: () => {
        if (!composeOpen) openCompose();
      },
      onReply: () => {
        if (detail && !composeOpen) {
          openCompose(buildReplyDraft(detail, false));
        }
      },
      onReplyAll: () => {
        if (detail && !composeOpen) {
          openCompose(buildReplyDraft(detail, true));
        }
      },
      onForward: () => {
        if (detail && !composeOpen) {
          openCompose(buildForwardDraft(detail));
        }
      },
      onDelete: () => {
        if (selected && !composeOpen) handleDelete();
      },
      onMarkUnread: () => {
        if (selected && !composeOpen && selected.is_read) {
          handleToggleRead(false);
        }
      },
      onFocusSearch: () => {
        searchInputRef.current?.focus();
      },
      onEscape: () => {
        if (composeOpen) {
          setComposeOpen(false);
          setComposeDraft(undefined);
          return;
        }
        if (shortcutsOpen) {
          setShortcutsOpen(false);
          return;
        }
        if (advancedSearch) {
          setAdvancedSearch(false);
          return;
        }
        if (searchMode) clearSearch();
      },
    },
    [
      loggedIn,
      shortcutsOpen,
      composeOpen,
      detail,
      selected,
      advancedSearch,
      searchMode,
    ]
  );

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
                {mailboxOptionLabel(m)}
              </option>
            ))}
          </select>
        )}
        <button
          type="button"
          className="btn"
          onClick={cycleTheme}
          title="切换浅色 / 深色 / 跟随系统"
        >
          {themeLabel}
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => setShortcutsOpen(true)}
        >
          快捷键
        </button>
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
          <div className="sidebar-section sidebar-section-row">
            <span>自定义文件夹</span>
            <button
              type="button"
              className="btn-link sidebar-manage-folders"
              onClick={() => void window.wpsMail.openWebMail()}
            >
              在 Web 管理
            </button>
          </div>
          <FolderTreeNav
            nodes={folderTree}
            allFolders={allFolders}
            activeFolderId={activeFolderId}
            searchMode={searchMode}
            expandedIds={expandedFolderIds}
            folderBadge={folderBadge}
            onToggleExpand={toggleFolderExpand}
            onSelect={selectFolder}
          />
          <div className="sidebar-footer">
            <button
              type="button"
              className="btn-link sidebar-help"
              onClick={() => setShortcutsOpen(true)}
            >
              键盘快捷键
            </button>
          </div>
        </nav>

        <section className="mail-list">
          <div className="list-toolbar">
            <input
              ref={searchInputRef}
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
            {threadGroups
              ? threadGroups.map((group) => (
                  <ThreadListItem
                    key={group.threadKey}
                    group={group}
                    folderId={folderId}
                    selectedId={selectedId}
                    expanded={expandedThreads.has(group.threadKey)}
                    formatTime={formatTime}
                    peerLabel={listRowPeerLabel}
                    onToggleExpand={toggleThreadExpand}
                    onSelect={(m) => void loadDetail(m)}
                  />
                ))
              : messages.map((m) => (
                  <div
                    key={m.message_id}
                    role="button"
                    tabIndex={0}
                    className={`mail-row ${!m.is_read ? "unread" : ""} ${selectedId === m.message_id ? "selected" : ""}`}
                    onClick={() => void loadDetail(m)}
                    onKeyDown={(e) =>
                      e.key === "Enter" && void loadDetail(m)
                    }
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
                {folderId === "drafts" && detail && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => openCompose(buildEditDraftFromMail(detail))}
                  >
                    继续编辑
                  </button>
                )}
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
                  {customMoveOptions
                    .filter((o) => o.folderId !== folderId)
                    .map((o) => (
                      <option key={o.folderId} value={o.folderId}>
                        {o.depth > 0
                          ? `${"　".repeat(o.depth)}└ ${o.label}`
                          : o.label}
                      </option>
                    ))}
                </select>
              </div>
              <header className="reader-header">
                <h2>{detail?.subject || selected.subject || "(无主题)"}</h2>
                {selectedThreadMessages.length > 1 && (
                  <div className="thread-nav">
                    <span className="thread-nav-label">
                      此会话共{" "}
                      {detail?.thread_message_count ??
                        selectedThreadMessages.length}{" "}
                      封
                    </span>
                    <div className="thread-nav-actions">
                      <button
                        type="button"
                        className="btn"
                        disabled={selectedThreadIndex <= 0}
                        onClick={() => {
                          const prev =
                            selectedThreadMessages[selectedThreadIndex - 1];
                          if (prev) void loadDetail(prev);
                        }}
                      >
                        上一封
                      </button>
                      <span className="thread-nav-pos">
                        {selectedThreadIndex + 1} /{" "}
                        {selectedThreadMessages.length}
                      </span>
                      <button
                        type="button"
                        className="btn"
                        disabled={
                          selectedThreadIndex < 0 ||
                          selectedThreadIndex >=
                            selectedThreadMessages.length - 1
                        }
                        onClick={() => {
                          const next =
                            selectedThreadMessages[selectedThreadIndex + 1];
                          if (next) void loadDetail(next);
                        }}
                      >
                        下一封
                      </button>
                    </div>
                  </div>
                )}
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
                <MailBodyReader body={bodyHtml} />
              </div>
            </>
          )}
        </section>
      </div>

      {composeOpen && mailboxId && (
        <ComposeModal
          mailboxId={mailboxId}
          mailboxes={mailboxes}
          defaultSendMailboxId={mailboxId}
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
          onSaved={() => {
            setComposeOpen(false);
            setComposeDraft(undefined);
            setFolderId("drafts");
            clearSearch();
            setDetail(null);
            setSelectedId(null);
            void loadMessages({ refresh: true });
          }}
        />
      )}
      {shortcutsOpen && (
        <ShortcutsHelpModal onClose={() => setShortcutsOpen(false)} />
      )}
    </div>
  );
}
