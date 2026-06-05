import { useCallback, useEffect, useRef } from "react";

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

  const runCmd = (cmd: string, val?: string) => {
    focusEditor();
    exec(cmd, val);
    syncFromDom();
  };

  const addLink = () => {
    const el = ref.current;
    if (!el) return;

    const raw = window.prompt("链接地址", "https://");
    const href = raw ? normalizeUrl(raw) : null;
    if (!href) return;

    focusEditor();
    const sel = window.getSelection();
    const label =
      sel && sel.rangeCount > 0 && !sel.getRangeAt(0).collapsed
        ? sel.toString()
        : href;

    if (sel && sel.rangeCount > 0 && el.contains(sel.anchorNode)) {
      const range = sel.getRangeAt(0);
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
        sel.removeAllRanges();
        sel.addRange(after);
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
        <button type="button" className="btn" title="插入链接" onClick={addLink}>
          链接
        </button>
      </div>
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
