import type { Mailbox } from "../types";

export function mailboxOptionLabel(m: Mailbox): string {
  const name = m.name?.trim() || m.email_address;
  if (m.is_primary) return name;
  return `${name} (公共)`;
}
