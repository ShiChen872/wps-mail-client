import { useCallback, useEffect, useRef, useState } from "react";

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
}

function exec(cmd: string, value?: string) {
  document.execCommand(cmd, false, value);
}

function normalizeUrl(raw: string): string | null {
  const url = raw.trim();
  if (!url || url === "https://" || url === "http://") return null;
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "正文",
  minHeight = 200,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const savedRangeRef = useRef<Range | null>(null);
  const linkInputRef = useRef<HTMLInputElement>(null);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("https://");
  const [linkError, setLinkError] = useState<string | null>(null);

  const syncFromDom = useCallback(() => {
    if (ref.current) onChange(ref.current.innerHTML);
  }, [onChange]);

  const focusEditor = () => {
    ref.current?.focus();
  };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.innerHTML !== value) {
      el.innerHTML = value || "";
    }
  }, [value]);

  useEffect(() => {
    if (linkDialogOpen) {
      linkInputRef.current?.focus();
      linkInputRef.current?.select();
    }
  }, [linkDialogOpen]);

  const runCmd = (cmd: string, val?: string) => {
    focusEditor();
    exec(cmd, val);
    syncFromDom();
  };

  const openLinkDialog = () => {
    const el = ref.current;
    if (!el) return;

    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && el.contains(sel.anchorNode)) {
      savedRangeRef.current = sel.getRangeAt(0).cloneRange();
    } else {
      savedRangeRef.current = null;
    }

    setLinkUrl("https://");
    setLinkError(null);
    setLinkDialogOpen(true);
  };

  const closeLinkDialog = () => {
    setLinkDialogOpen(false);
    setLinkError(null);
    savedRangeRef.current = null;
    focusEditor();
  };

  const insertLink = () => {
    const el = ref.current;
    if (!el) return;

    const href = normalizeUrl(linkUrl);
    if (!href) {
      setLinkError("请输入有效的链接地址");
      return;
    }

    focusEditor();
    const sel = window.getSelection();
    const range = savedRangeRef.current;
    const label =
      range && !range.collapsed ? range.toString() : href;

    if (range && el.contains(range.startContainer)) {
      sel?.removeAllRanges();
      sel?.addRange(range);

      if (range.collapsed) {
        const a = document.createElement("a");
        a.href = href;
        a.textContent = label;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        range.insertNode(a);
        const after = document.createRange();
        after.setStartAfter(a);
        after.collapse(true);
        sel?.removeAllRanges();
        sel?.addRange(after);
      } else {
        exec("createLink", href);
        el.querySelectorAll("a").forEach((a) => {
          if (a.getAttribute("href") === href || a.href === href) {
            a.target = "_blank";
            a.rel = "noopener noreferrer";
          }
        });
      }
    } else {
      const safeLabel = label.replace(/</g, "&lt;");
      const safeHref = href.replace(/"/g, "&quot;");
      el.innerHTML +=
        (el.innerHTML ? "<br>" : "") +
        `<a href="${safeHref}" target="_blank" rel="noopener noreferrer">${safeLabel}</a>`;
    }

    closeLinkDialog();
    syncFromDom();
  };

  return (
    <div className="rich-editor">
      <div className="rich-toolbar" role="toolbar" aria-label="格式">
        <button
          type="button"
          className="btn"
          title="粗体"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => runCmd("bold")}
        >
          <b>B</b>
        </button>
        <button
          type="button"
          className="btn"
          title="斜体"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => runCmd("italic")}
        >
          <i>I</i>
        </button>
        <button
          type="button"
          className="btn"
          title="下划线"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => runCmd("underline")}
        >
          <u>U</u>
        </button>
        <button
          type="button"
          className="btn"
          title="无序列表"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => runCmd("insertUnorderedList")}
        >
          • 列表
        </button>
        <button
          type="button"
          className={`btn${linkDialogOpen ? " rich-toolbar-active" : ""}`}
          title="插入链接"
          onMouseDown={(e) => e.preventDefault()}
          onClick={openLinkDialog}
        >
          链接
        </button>
      </div>
      {linkDialogOpen && (
        <div className="rich-link-dialog" role="dialog" aria-label="插入链接">
          <label className="rich-link-label" htmlFor="rich-link-url">
            链接地址
          </label>
          <input
            id="rich-link-url"
            ref={linkInputRef}
            type="text"
            className="rich-link-input"
            value={linkUrl}
            placeholder="https://example.com 或 www.baidu.com"
            onChange={(e) => {
              setLinkUrl(e.target.value);
              if (linkError) setLinkError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                insertLink();
              }
              if (e.key === "Escape") {
                e.preventDefault();
                closeLinkDialog();
              }
            }}
          />
          <div className="rich-link-actions">
            <button type="button" className="btn btn-primary" onClick={insertLink}>
              插入
            </button>
            <button type="button" className="btn" onClick={closeLinkDialog}>
              取消
            </button>
          </div>
          {linkError && <p className="rich-link-error">{linkError}</p>}
        </div>
      )}
      <div
        ref={ref}
        className="rich-body"
        contentEditable
        role="textbox"
        aria-multiline
        data-placeholder={placeholder}
        style={{ minHeight }}
        onInput={syncFromDom}
        onBlur={syncFromDom}
        suppressContentEditableWarning
      />
    </div>
  );
}
