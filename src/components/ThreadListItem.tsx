import type { MailListItem } from "../types";
import type { ThreadGroup } from "../lib/threads";
import { isMultiMessageThread } from "../lib/threads";

interface Props {
  group: ThreadGroup;
  folderId: string;
  selectedId: string | null;
  expanded: boolean;
  formatTime: (ts: number) => string;
  peerLabel: (m: MailListItem, folderId: string) => string;
  onToggleExpand: (threadKey: string) => void;
  onSelect: (m: MailListItem) => void;
}

function RowMeta({
  m,
  folderId,
  formatTime,
  peerLabel,
}: {
  m: MailListItem;
  folderId: string;
  formatTime: (ts: number) => string;
  peerLabel: (m: MailListItem, folderId: string) => string;
}) {
  return (
    <div className="meta">
      <span>{peerLabel(m, folderId)}</span>
      <span>{formatTime(m.ctime)}</span>
    </div>
  );
}

export function ThreadListItem({
  group,
  folderId,
  selectedId,
  expanded,
  formatTime,
  peerLabel,
  onToggleExpand,
  onSelect,
}: Props) {
  const multi = isMultiMessageThread(group);
  const { latest } = group;
  const hasUnread = group.unreadCount > 0;
  const selectedInGroup = group.items.some((m) => m.message_id === selectedId);

  if (!multi) {
    const m = latest;
    return (
      <div
        role="button"
        tabIndex={0}
        className={`mail-row ${!m.is_read ? "unread" : ""} ${selectedId === m.message_id ? "selected" : ""}`}
        onClick={() => onSelect(m)}
        onKeyDown={(e) => e.key === "Enter" && onSelect(m)}
      >
        <div className="subject">{m.subject || "(无主题)"}</div>
        <RowMeta
          m={m}
          folderId={folderId}
          formatTime={formatTime}
          peerLabel={peerLabel}
        />
      </div>
    );
  }

  return (
    <div
      className={`thread-group ${hasUnread ? "thread-unread" : ""} ${selectedInGroup ? "thread-selected" : ""}`}
    >
      <div
        role="button"
        tabIndex={0}
        className={`mail-row thread-header ${!latest.is_read ? "unread" : ""} ${selectedId === latest.message_id ? "selected" : ""}`}
        onClick={() => onSelect(latest)}
        onKeyDown={(e) => e.key === "Enter" && onSelect(latest)}
      >
        <div className="thread-header-top">
          <button
            type="button"
            className="thread-expand"
            aria-expanded={expanded}
            aria-label={expanded ? "折叠会话" : "展开会话"}
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(group.threadKey);
            }}
          >
            {expanded ? "▾" : "▸"}
          </button>
          <div className="subject thread-subject">
            {latest.subject || "(无主题)"}
          </div>
          <span className="thread-count">{group.items.length}</span>
        </div>
        <RowMeta
          m={latest}
          folderId={folderId}
          formatTime={formatTime}
          peerLabel={peerLabel}
        />
        {hasUnread && (
          <span className="thread-unread-badge">
            {group.unreadCount} 未读
          </span>
        )}
      </div>
      {expanded && (
        <ul className="thread-children">
          {group.items.map((m) => (
            <li key={m.message_id}>
              <div
                role="button"
                tabIndex={0}
                className={`mail-row thread-child ${!m.is_read ? "unread" : ""} ${selectedId === m.message_id ? "selected" : ""}`}
                onClick={() => onSelect(m)}
                onKeyDown={(e) => e.key === "Enter" && onSelect(m)}
              >
                <div className="subject">{m.subject || "(无主题)"}</div>
                <RowMeta
                  m={m}
                  folderId={folderId}
                  formatTime={formatTime}
                  peerLabel={peerLabel}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
