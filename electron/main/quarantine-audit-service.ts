import type { AppConfig } from "./config";

export interface QuarantineAuditPayload {
  action: "pass" | "reject" | "detail";
  ruleId: string;
  isolateId?: string;
  apiPath?: string;
  detailPath?: string;
}

export interface QuarantineAuditResult {
  ok: boolean;
  message: string;
  needsWebMail?: boolean;
}

/**
 * WPS 365 邮箱架构（与 Web F12 一致）：
 * - 页面：https://365.kdocs.cn/email/
 * - API：https://email.wps.cn/api/v1|v2/...
 */
function apiUrl(config: AppConfig, path: string): string {
  const base = config.webMailApiBase.replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

async function checkUserPrivileges(
  config: AppConfig,
  token: string
): Promise<boolean> {
  try {
    const res = await fetch(apiUrl(config, "/api/v1/user/privileges"), {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function executeQuarantineAction(
  config: AppConfig,
  getAccessToken: () => Promise<string | null>,
  payload: QuarantineAuditPayload
): Promise<QuarantineAuditResult> {
  if (payload.action === "detail") {
    return {
      ok: false,
      needsWebMail: true,
      message:
        "查看隔离详情请在 365.kdocs.cn/email 中打开（接口由 email.wps.cn 提供）。",
    };
  }

  if (!payload.isolateId) {
    return {
      ok: false,
      needsWebMail: true,
      message: "无法解析隔离邮件 ID，请在 365.kdocs.cn/email 中处理此审批。",
    };
  }

  const token = await getAccessToken();
  if (!token) {
    return { ok: false, needsWebMail: true, message: "未登录，请先授权登录。" };
  }

  await checkUserPrivileges(config, token);

  const auditPath =
    payload.apiPath || "/api/v2/mail/mail_isolate/data_protect/audit";
  const url = apiUrl(config, auditPath);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        action: payload.action,
        rule_id: payload.ruleId,
        isolate_id: payload.isolateId,
      }),
    });
    const text = await res.text();
    if (res.ok) {
      return {
        ok: true,
        message:
          payload.action === "pass"
            ? "已通过隔离审批，邮件将放行。"
            : "已拒绝该邮件。",
      };
    }

    if (text.includes("GatewayAuthError") || text.includes("PermissionDenied")) {
      return {
        ok: false,
        needsWebMail: true,
        message:
          "隔离审批 API（email.wps.cn）需 365.kdocs.cn/email 页面登录会话，桌面 OAuth 无法替代。请在浏览器邮箱内点击「通过」。",
      };
    }

    return {
      ok: false,
      needsWebMail: true,
      message: `审批请求失败 (${res.status})：${text.slice(0, 120)}。请在 365.kdocs.cn/email 中重试。`,
    };
  } catch (e) {
    return {
      ok: false,
      needsWebMail: true,
      message: `网络错误：${e instanceof Error ? e.message : String(e)}。请在 365.kdocs.cn/email 中处理。`,
    };
  }
}
