import type { CreateDraftBody, MailRecipient } from "@wps-mail/mail-api";

export interface ComposePayload {
  mailboxId: string;
  subject: string;
  body: string;
  isHtml?: boolean;
  to: string;
  cc?: string;
  bcc?: string;
}

export function parseRecipients(raw: string): MailRecipient[] {
  return raw
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((email_address) => ({ email_address, name: email_address }));
}

export function buildCreateDraftBody(payload: ComposePayload): CreateDraftBody {
  const isHtml = Boolean(payload.isHtml);
  return {
    subject: payload.subject,
    body: payload.body,
    body_version: isHtml ? "v2" : "v1",
    to_recipients: parseRecipients(payload.to),
    cc_recipients: payload.cc ? parseRecipients(payload.cc) : undefined,
    bcc_recipients: payload.bcc ? parseRecipients(payload.bcc) : undefined,
  };
}
