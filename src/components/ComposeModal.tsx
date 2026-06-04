import { useEffect, useState } from "react";
import type { ComposeDraft } from "../lib/compose";

interface Props {
  mailboxId: string;
  initial?: ComposeDraft;
  contactSuggestions?: string[];
  onClose: () => void;
  onSent: () => void;
}

export function ComposeModal({
  mailboxId,
  initial,
  contactSuggestions = [],
  onClose,
  onSent,
}: Props) {
  const [to, setTo] = useState(initial?.to ?? "");
  const [cc, setCc] = useState(initial?.cc ?? "");
  const [bcc, setBcc] = useState(initial?.bcc ?? "");
  const [subject, setSubject] = useState(initial?.subject ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showBcc, setShowBcc] = useState(Boolean(initial?.bcc));

  useEffect(() => {
    if (initial) {
      setTo(initial.to);
      setCc(initial.cc);
      setBcc(initial.bcc);
      setSubject(initial.subject);
      setBody(initial.body);
      setShowBcc(Boolean(initial.bcc));
    }
  }, [initial]);

  const handleSend = async () => {
    if (!to.trim()) {
      setError("请填写收件人");
      return;
    }
    setSending(true);
    setError(null);
    try {
      await window.wpsMail.send({
        mailboxId,
        to: to.trim(),
        cc: cc.trim() || undefined,
        bcc: bcc.trim() || undefined,
        subject,
        body,
      });
      onSent();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="compose-overlay" role="dialog" aria-modal="true">
      <div className="compose-panel">
        <header>{initial?.title ?? "新邮件"}</header>
        <div className="compose-fields">
          <input
            placeholder="收件人（多个用逗号分隔）"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            list="wps-mail-contacts"
          />
          <input
            placeholder="抄送（可选）"
            value={cc}
            onChange={(e) => setCc(e.target.value)}
            list="wps-mail-contacts"
          />
          {!showBcc ? (
            <button
              type="button"
              className="btn-link"
              onClick={() => setShowBcc(true)}
            >
              添加密送
            </button>
          ) : (
            <input
              placeholder="密送 BCC（可选）"
              value={bcc}
              onChange={(e) => setBcc(e.target.value)}
              list="wps-mail-contacts"
            />
          )}
          {contactSuggestions.length > 0 && (
            <datalist id="wps-mail-contacts">
              {contactSuggestions.map((e) => (
                <option key={e} value={e} />
              ))}
            </datalist>
          )}
          <input
            placeholder="主题"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
          <textarea
            placeholder="正文"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          {error && <p style={{ color: "#cf1322", margin: 0 }}>{error}</p>}
        </div>
        <div className="compose-actions">
          <button type="button" className="btn" onClick={onClose} disabled={sending}>
            取消
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void handleSend()}
            disabled={sending}
          >
            {sending ? "发送中…" : "发送"}
          </button>
        </div>
      </div>
    </div>
  );
}
