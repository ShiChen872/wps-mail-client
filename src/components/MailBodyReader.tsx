import { useCallback, useMemo } from "react";
import {
  decodeHtmlEntities,
  looksLikeHtml,
  plainTextToReaderHtml,
  sanitizeMailHtml,
} from "../lib/html";
import {
  isQuarantineNotificationMail,
  parseQuarantineActions,
  type QuarantineMailAction,
} from "../lib/quarantine-mail";

function extractHttpUrls(text: string): string[] {
  const found = new Set<string>();
  const decoded = decodeHtmlEntities(text);
  for (const m of decoded.matchAll(/href\s*=\s*["'](https?:\/\/[^"']+)["']/gi)) {
    found.add(m[1]);
  }
  for (const m of decoded.matchAll(/data-href\s*=\s*["'](https?:\/\/[^"']+)["']/gi)) {
    found.add(m[1]);
  }
  for (const m of decoded.matchAll(/(https?:\/\/[^\s<>"')\]]+)/gi)) {
    found.add(m[1].replace(/[.,;:!?]+$/, ""));
  }
  return [...found];
}

interface Props {
  body: string;
}

export function MailBodyReader({ body }: Props) {
  const isHtml = looksLikeHtml(body);
  const html = useMemo(
    () => (isHtml ? sanitizeMailHtml(body) : ""),
    [body, isHtml]
  );
  const plainHtml = useMemo(
    () => (isHtml ? "" : plainTextToReaderHtml(body)),
    [body, isHtml]
  );

  const urls = useMemo(() => extractHttpUrls(body), [body]);
  const quarantineActions = useMemo(
    () => (isHtml ? parseQuarantineActions(body) : []),
    [body, isHtml]
  );
  const isQuarantineMail = useMemo(
    () => isHtml && isQuarantineNotificationMail(body),
    [body, isHtml]
  );

  const openUrl = useCallback(async (url: string) => {
    const href = decodeHtmlEntities(url).trim();
    if (!/^https?:\/\//i.test(href)) return;
    try {
      await window.wpsMail.openExternal(href);
    } catch (e) {
      window.alert(
        `无法打开链接：${e instanceof Error ? e.message : String(e)}\n\n请复制到浏览器：\n${href}`
      );
    }
  }, []);

  const runQuarantineAction = useCallback(async (action: QuarantineMailAction) => {
    const result = await window.wpsMail.executeQuarantineAction({
      action: action.kind,
      ruleId: action.ruleId,
      isolateId: action.isolateId,
      apiPath: action.apiPath,
      detailPath: action.detailPath,
    });

    if (result.ok) {
      window.alert(result.message);
      return;
    }

    const openWeb = result.needsWebMail
      ? window.confirm(`${result.message}\n\n是否现在打开 365.kdocs.cn/email？`)
      : false;
    if (openWeb) {
      await window.wpsMail.openWebMail();
    } else if (!result.needsWebMail) {
      window.alert(result.message);
    }
  }, []);

  const onBodyClickCapture = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;

      const actionEl = target.closest<HTMLElement>(".wps-mail-action-btn,[data-wps-action]");
      if (actionEl) {
        const kind = actionEl.getAttribute("data-wps-action");
        const ruleId = actionEl.getAttribute("data-rule-id") || "";
        const isolateId = actionEl.getAttribute("data-isolate-id") || undefined;
        const path = actionEl.getAttribute("data-action-path") || undefined;
        if (kind === "pass" || kind === "reject" || kind === "detail") {
          e.preventDefault();
          e.stopPropagation();
          void runQuarantineAction({
            kind,
            label: actionEl.textContent?.trim() || kind,
            ruleId,
            isolateId,
            apiPath: kind !== "detail" ? path : undefined,
            detailPath: kind === "detail" ? path : undefined,
          });
        }
        return;
      }

      const linkEl = target.closest<HTMLElement>(
        ".mail-external-link,[data-href],a"
      );
      if (!linkEl) return;

      const href =
        linkEl.getAttribute("data-href") ||
        linkEl.getAttribute("href") ||
        linkEl.dataset.href ||
        "";
      if (!href || href.startsWith("#") || /^javascript:/i.test(href)) return;

      e.preventDefault();
      e.stopPropagation();
      void openUrl(href);
    },
    [openUrl, runQuarantineAction]
  );

  const onBodyKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      const target = e.target as HTMLElement;
      if (
        target.classList.contains("mail-external-link") ||
        target.classList.contains("wps-mail-action-btn")
      ) {
        e.preventDefault();
        (target as HTMLElement).click();
      }
    },
    []
  );

  return (
    <div className="mail-body-reader">
      {isQuarantineMail && (
        <div className="mail-quarantine-banner">
          <p>
            此为<strong>邮件隔离审批</strong>系统通知。原邮件按钮需在{" "}
            <a
              className="mail-inline-link"
              href="https://365.kdocs.cn/email/"
              onClick={(e) => {
                e.preventDefault();
                void window.wpsMail.openWebMail();
              }}
            >
              365.kdocs.cn/email
            </a>{" "}
            内点击（接口走 email.wps.cn）；下方提供快捷入口：
          </p>
          <div className="mail-quarantine-actions">
            {quarantineActions
              .filter((a) => a.kind === "pass" || a.kind === "reject")
              .map((a) => (
                <button
                  key={`${a.kind}-${a.isolateId}`}
                  type="button"
                  className={`btn ${a.kind === "pass" ? "btn-primary" : ""}`}
                  onClick={() => void runQuarantineAction(a)}
                >
                  {a.label}
                </button>
              ))}
            <button
              type="button"
              className="btn"
              onClick={() => void window.wpsMail.openWebMail()}
            >
              打开 365 邮箱
            </button>
          </div>
        </div>
      )}

      {isHtml ? (
        <div
          className="mail-body-html"
          onClickCapture={onBodyClickCapture}
          onKeyDown={onBodyKeyDown}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <div
          className="mail-body-plain"
          onClickCapture={onBodyClickCapture}
          onKeyDown={onBodyKeyDown}
          dangerouslySetInnerHTML={{ __html: plainHtml }}
        />
      )}

      {urls.length > 0 && !isQuarantineMail && (
        <div className="mail-body-links">
          <div className="mail-body-links-title">邮件中的链接</div>
          {urls.map((url) => (
            <button
              key={url}
              type="button"
              className="btn btn-primary mail-body-link-btn"
              onClick={() => void openUrl(url)}
            >
              打开链接
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
