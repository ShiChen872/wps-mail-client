import type { MailDetail, MailRecipient } from "../types";

function emailsFromRecipients(list?: MailRecipient[]): string {
  if (!list?.length) return "";
  return list
    .map((r) => r.email_address)
    .filter(Boolean)
    .join(", ");
}

function quoteBody(detail: MailDetail): string {
  const from =
    detail.from?.name || detail.from?.email_address || detail.sender || "";
  const when = detail.ctime
    ? new Date(detail.ctime * 1000).toLocaleString("zh-CN")
    : "";
  const body = detail.body ?? detail.body_preview ?? "";
  const plain = body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return `\n\n-------- 原始邮件 --------\n发件人: ${from}\n时间: ${when}\n主题: ${detail.subject || ""}\n\n${plain}`;
}

export interface ComposeDraft {
  title: string;
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  body: string;
}

export function buildReplyDraft(
  detail: MailDetail,
  replyAll: boolean
): ComposeDraft {
  const fromEmail = detail.from?.email_address ?? "";
  let cc = "";
  if (replyAll) {
    const ccList = (detail.cc_recipient ?? []).filter(
      (r) => r.email_address && r.email_address !== fromEmail
    );
    cc = emailsFromRecipients(ccList);
  }
  const subj = detail.subject?.startsWith("Re:")
    ? detail.subject
    : `Re: ${detail.subject || ""}`;
  return {
    title: replyAll ? "全部回复" : "回复",
    to: fromEmail,
    cc,
    bcc: "",
    subject: subj,
    body: quoteBody(detail),
  };
}

export function buildForwardDraft(detail: MailDetail): ComposeDraft {
  const subj = detail.subject?.startsWith("Fwd:")
    ? detail.subject
    : `Fwd: ${detail.subject || ""}`;
  return {
    title: "转发",
    to: "",
    cc: "",
    bcc: "",
    subject: subj,
    body: quoteBody(detail),
  };
}
