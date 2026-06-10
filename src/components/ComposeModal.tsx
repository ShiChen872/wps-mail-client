import { useEffect, useState } from "react";
import type { ComposeDraft } from "../lib/compose";
import { looksLikeHtml, normalizeComposeBody, plainTextToHtml } from "../lib/html";
import { RichTextEditor } from "./RichTextEditor";
import { CloudDocPickerModal, type CloudDocItem } from "./CloudDocPickerModal";

interface AddedFileItem {
  id: string;
  name: string;
  kind: "embedded" | "cloud";
}

interface Props {
  mailboxId: string;
  initial?: ComposeDraft;
  contactSuggestions?: string[];
  onClose: () => void;
  onSent: () => void;
}

let addedFileSeq = 0;

function nextAddedFileId(): string {
  addedFileSeq += 1;
  return `file-${addedFileSeq}`;
}

function kindLabel(kind: AddedFileItem["kind"]): string {
  return kind === "embedded" ? "已嵌入" : "云文档链接";
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
  const [addedFiles, setAddedFiles] = useState<AddedFileItem[]>([]);
  const [sending, setSending] = useState(false);
  const [fileBusy, setFileBusy] = useState(false);
  const [showCloudPicker, setShowCloudPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileStatus, setFileStatus] = useState<string | null>(null);
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

  const appendHtmlToBody = (html: string) => {
    if (!html) return;
    setUseRichText(true);
    setBodyHtml((prev) => `${prev}${html}`);
  };

  const handleAddFiles = async () => {
    const res = await window.wpsMail.pickAttachments();
    if (res.canceled || !res.files.length) return;

    setFileBusy(true);
    setError(null);
    setFileStatus(null);
    try {
      const result = await window.wpsMail.processComposeFiles(
        res.files.map((f) => f.path)
      );
      if (result.files.length > 0) {
        appendHtmlToBody(result.files.map((f) => f.html).join(""));
        setAddedFiles((prev) => [
          ...prev,
          ...result.files.map((f) => ({
            id: nextAddedFileId(),
            name: f.name,
            kind: f.kind,
          })),
        ]);
      }
      if (result.summary) {
        setFileStatus(result.summary);
      }
      if (result.errors.length > 0) {
        const msg = result.errors
          .map((e) => `${e.name}: ${e.message}`)
          .join("\n");
        setError(
          result.files.length > 0
            ? `部分文件处理失败：\n${msg}`
            : `添加文件失败：\n${msg}`
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setFileBusy(false);
    }
  };

  const insertCloudLinks = async (picked: CloudDocItem[]) => {
    setFileBusy(true);
    setError(null);
    try {
      const result = await window.wpsMail.createCloudLinks(
        picked.map((f) => ({
          driveId: f.driveId,
          fileId: f.fileId,
          name: f.name,
          linkUrl: f.linkUrl,
        }))
      );
      if (result.items.length > 0) {
        appendHtmlToBody(result.items.map((i) => i.html).join(""));
        setAddedFiles((prev) => [
          ...prev,
          ...result.items.map((i) => ({
            id: nextAddedFileId(),
            name: i.name,
            kind: "cloud" as const,
          })),
        ]);
        setFileStatus(`已添加 ${result.items.length} 个云文档链接`);
      }
      if (result.errors.length > 0) {
        const msg = result.errors
          .map((e) => `${e.name}: ${e.message}`)
          .join("\n");
        setError(
          result.items.length > 0
            ? `部分云文档未生成链接：\n${msg}`
            : `云文档链接失败：\n${msg}`
        );
      }
    } finally {
      setFileBusy(false);
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
      await window.wpsMail.send({
        mailboxId,
        to: to.trim(),
        cc: cc.trim() || undefined,
        bcc: bcc.trim() || undefined,
        subject,
        body,
        isHtml: useRichText,
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
              className="btn btn-primary"
              onClick={() => void handleAddFiles()}
              disabled={sending || fileBusy}
            >
              {fileBusy ? "处理中…" : "添加文件"}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => setShowCloudPicker(true)}
              disabled={sending || fileBusy}
            >
              从云文档选择
            </button>
          </div>
          <p className="compose-hint">
            <strong>添加文件</strong> 会自动分流：小图（≤2MB）嵌入正文，其他文件转为云文档链接（开放平台暂无
            MIME 附件上传）。
          </p>
          {fileStatus && (
            <p className="compose-file-status">{fileStatus}</p>
          )}
          {addedFiles.length > 0 && (
            <ul className="compose-attachments">
              {addedFiles.map((a) => (
                <li key={a.id}>
                  <span>{a.name}</span>
                  <span className={`compose-file-tag compose-file-tag-${a.kind}`}>
                    {kindLabel(a.kind)}
                  </span>
                  <button
                    type="button"
                    className="btn-link"
                    onClick={() =>
                      setAddedFiles((prev) => prev.filter((x) => x.id !== a.id))
                    }
                  >
                    移除记录
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
            disabled={sending || fileBusy}
          >
            {sending ? "发送中…" : "发送"}
          </button>
        </div>
      </div>
      {showCloudPicker && (
        <CloudDocPickerModal
          onClose={() => setShowCloudPicker(false)}
          onConfirm={insertCloudLinks}
        />
      )}
    </div>
  );
}
