export interface QuarantineMailAction {
  kind: "pass" | "reject" | "detail";
  label: string;
  ruleId: string;
  isolateId?: string;
  detailPath?: string;
  apiPath?: string;
}

function parseAnchorTag(tag: string, label: string): QuarantineMailAction | null {
  const id = tag.match(/\bid="([^"]+)"/i)?.[1] ?? "";
  const actionAttr = tag.match(/\baction="([^"]+)"/i)?.[1];
  const pathAttr = tag.match(/\bpath="([^"]+)"/i)?.[1];

  const acceptRefuse = id.match(
    /kmanagerRule(?:Accept|Refuse)_([0-9a-f-]+)_([0-9a-z]+)/i
  );
  if (acceptRefuse) {
    const kind: QuarantineMailAction["kind"] = id.includes("RuleRefuse")
      ? "reject"
      : "pass";
    return {
      kind,
      label: label || (kind === "reject" ? "拒绝" : "通过"),
      ruleId: acceptRefuse[1],
      isolateId: acceptRefuse[2],
      apiPath: pathAttr,
    };
  }

  const info = id.match(/kmanagerRuleInfo_([0-9a-f-]+)_/i);
  if (info) {
    return {
      kind: "detail",
      label: label || "查看详情",
      ruleId: info[1],
      detailPath: pathAttr,
    };
  }

  return null;
}

/** 解析 WPS 系统邮件中的隔离审批按钮（data-protact-rule-button） */
export function parseQuarantineActions(html: string): QuarantineMailAction[] {
  if (!html.includes("data-protact-rule-button")) return [];

  const actions: QuarantineMailAction[] = [];
  const re =
    /<a\b[^>]*class="data-protact-rule-button"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(re)) {
    const parsed = parseAnchorTag(match[0], match[1].replace(/<[^>]+>/g, "").trim());
    if (parsed) actions.push(parsed);
  }

  return actions;
}

export function isQuarantineNotificationMail(html: string): boolean {
  return parseQuarantineActions(html).length > 0;
}

/** 将系统邮件里的审批按钮改为客户端可点击元素 */
export function rewriteQuarantineButtons(html: string): string {
  return html.replace(
    /<a\b[^>]*class="data-protact-rule-button"[^>]*>([\s\S]*?)<\/a>/gi,
    (tag, inner) => {
      const parsed = parseAnchorTag(tag, inner.replace(/<[^>]+>/g, "").trim());
      if (!parsed) return inner;

      const attrs = [
        `class="wps-mail-action-btn"`,
        `role="button"`,
        `tabindex="0"`,
        `data-wps-action="${parsed.kind}"`,
        `data-rule-id="${parsed.ruleId}"`,
      ];
      if (parsed.isolateId) {
        attrs.push(`data-isolate-id="${parsed.isolateId}"`);
      }
      if (parsed.apiPath) {
        attrs.push(`data-action-path="${parsed.apiPath}"`);
      }
      if (parsed.detailPath) {
        attrs.push(`data-action-path="${parsed.detailPath}"`);
      }
      return `<span ${attrs.join(" ")}>${inner}</span>`;
    }
  );
}
