import type { MailListItem } from "../types";

export interface ThreadGroup {
  /** thread_id，或单封邮件的 message_id */
  threadKey: string;
  threadId?: string;
  items: MailListItem[];
  latest: MailListItem;
  unreadCount: number;
}

export function groupByThread(items: MailListItem[]): ThreadGroup[] {
  const map = new Map<string, MailListItem[]>();

  for (const m of items) {
    const key = m.thread_id?.trim() || m.message_id;
    const list = map.get(key);
    if (list) list.push(m);
    else map.set(key, [m]);
  }

  const groups: ThreadGroup[] = [];
  for (const [threadKey, list] of map) {
    const sorted = [...list].sort((a, b) => b.ctime - a.ctime);
    const latest = sorted[0];
    groups.push({
      threadKey,
      threadId: latest.thread_id,
      items: sorted,
      latest,
      unreadCount: sorted.filter((row) => !row.is_read).length,
    });
  }

  return groups.sort((a, b) => b.latest.ctime - a.latest.ctime);
}

export function isMultiMessageThread(group: ThreadGroup): boolean {
  return group.items.length > 1;
}

export function threadMessagesForItem(
  messages: MailListItem[],
  item: MailListItem
): MailListItem[] {
  const tid = item.thread_id?.trim();
  if (!tid) return [item];
  return messages
    .filter((m) => m.thread_id === tid)
    .sort((a, b) => a.ctime - b.ctime);
}
