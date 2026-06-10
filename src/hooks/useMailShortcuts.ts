import { useEffect } from "react";

export interface MailShortcutHandlers {
  onNewMail: () => void;
  onReply: () => void;
  onReplyAll: () => void;
  onForward: () => void;
  onDelete: () => void;
  onMarkUnread: () => void;
  onFocusSearch: () => void;
  onEscape: () => void;
  enabled?: boolean;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return Boolean(target.closest(".rich-body"));
}

export function useMailShortcuts(
  handlers: MailShortcutHandlers,
  deps: unknown[] = []
) {
  useEffect(() => {
    if (handlers.enabled === false) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;

      const editable = isEditableTarget(e.target);

      if (e.key === "Escape") {
        handlers.onEscape();
        return;
      }

      if (editable) return;

      const key = e.key.toLowerCase();

      if (key === "n" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        handlers.onNewMail();
        return;
      }

      if (key === "r" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        if (e.shiftKey) handlers.onReplyAll();
        else handlers.onReply();
        return;
      }

      if (key === "f" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        handlers.onForward();
        return;
      }

      if (e.key === "Delete") {
        e.preventDefault();
        handlers.onDelete();
        return;
      }

      if (key === "u" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        handlers.onMarkUnread();
        return;
      }

      if (key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        handlers.onFocusSearch();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handlers.enabled, ...deps]);
}
