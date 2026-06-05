import { useEffect, useState } from "react";
import type { ComposeDraft } from "../lib/compose";
import { looksLikeHtml, normalizeComposeBody, plainTextToHtml } from "../lib/html";
import { RichTextEditor } from "./RichTextEditor";

interface AttachmentItem {
  path: string;
  name: string;
}

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
  const [bodyHtml, setBodyHtml] = useState(() => {
    const b = initial?.body ?? "";
    return looksLikeHtml(b) ? b : plainTextToHtml(b);
  });
  const [plainBody, setPlainBody] = useState(initial?.body ?? "");
  const [useRichText, setUseRichText] = useState(true);
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [sending, setSending] = useState(false);
  const [cloudBusy, setCloudBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showBcc, setShowBcc] = useState(Boolean(initial?.bcc));

  useEffect(() => {
    if (initial) {
      setTo(initial.to);
      setCc(initial.cc);
      setBcc(initial.bcc);
      setSubject(initial.subject);
      const b = initial.body;
      setPlainBody(b);
      setBodyHtml(looksLikeHtml(b) ? b : plainTextToHtml(b));
      setShowBcc(Boolean(initial.bcc));
    }
  }, [initial]);

  const handlePickAttachments = async () => {
    const res = await window.wpsMail.pickAttachments();
    if (res.canceled || !res.files.length) return;
    setAttachments((prev) => {
      const seen = new Set(prev.map((a) => a.path));
      const add = res.files.filter((f) => !seen.has(f.path));
      return [...prev, ...add];
    });
  };

  /** V1.3：上传至云文档并插入分享链接（类 OWA OneDrive 链接附件） */
  const handleCloudLinkAttachments = async () => {
    const res = await window.wpsMail.pickAttachments();
    if (res.canceled || !res.files.length) return;
    setCloudBusy(true);
    setError(null);
    try {
      const uploaded = await window.wpsMail.uploadCloudLinks(
        res.files.map((f) => f.path)
      );
      if (uploaded.items.length > 0) {
        setUseRichText(true);
        const block = uploaded.items.map((i) => i.html).join("");
        setBodyHtml((prev) => `${prev}${block}`);
      }
      if (uploaded.errors.length > 0) {
        const msg = uploaded.errors
          .map((e) => `${e.name}: ${e.message}`)
          .join("\n");
        setError(
          uploaded.items.length > 0
            ? `部分文件未生成云链接：\n${msg}\n请确认开放平台已开通云文档 scope 并重新登录。`
            : `云文档链接失败：\n${msg}\n请确认已开通 kso.drive/file/file_link 权限并重新 OAuth 登录。`
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCloudBusy(false);
    }
  };

  const handleSend = async () => {
    if (!to.trim()) {
      setError("请填写收件人");
      return;
    }
    setSending(true);
    setError(null);
    try {
      const body = useRichText
        ? normalizeComposeBody(bodyHtml, true)
        : normalizeComposeBody(plainBody, false);
      const res = await window.wpsMail.send({
        mailboxId,
        to: to.trim(),
        cc: cc.trim() || undefined,
        bcc: bcc.trim() || undefined,
        subject,
        body,
        isHtml: useRichText,
        attachmentPaths: attachments.map((a) => a.path),
      });
      if (res.attachmentWarning) {
        window.alert(res.attachmentWarning);
      }
      onSent();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="compose-overlay" role="dialog" aria-modal="true">
      <div className="compose-panel compose-panel-wide">
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
          <div className="compose-format-row">
            <label>
              <input
                type="checkbox"
                checked={useRichText}
                onChange={(e) => setUseRichText(e.target.checked)}
              />
              富文本格式
            </label>
            <button
              type="button"
              className="btn"
              onClick={() => void handlePickAttachments()}
              disabled={sending || cloudBusy}
            >
              嵌入图片
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void handleCloudLinkAttachments()}
              disabled={sending || cloudBusy}
            >
              {cloudBusy ? "上传中…" : "云文档链接"}
            </button>
          </div>
          <p className="compose-hint">
            <strong>云文档链接</strong>（推荐，类 OWA OneDrive）：大文件上传至「我的云文档 →
            WPS Mail/附件」并插入分享链。<strong>嵌入图片</strong>：小图（≤2MB）直接进正文。
          </p>
          {attachments.length > 0 && (
            <ul className="compose-attachments">
              {attachments.map((a) => (
                <li key={a.path}>
                  <span>{a.name}</span>
                  <button
                    type="button"
                    className="btn-link"
                    onClick={() =>
                      setAttachments((prev) =>
                        prev.filter((x) => x.path !== a.path)
                      )
                    }
                  >
                    移除
                  </button>
                </li>
              ))}
            </ul>
          )}
          {useRichText ? (
            <RichTextEditor value={bodyHtml} onChange={setBodyHtml} />
          ) : (
            <textarea
              placeholder="正文"
              value={plainBody}
              onChange={(e) => setPlainBody(e.target.value)}
            />
          )}
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
            disabled={sending || cloudBusy}
          >
            {sending ? "发送中…" : "发送"}
          </button>
        </div>
      </div>
    </div>
  );
}
