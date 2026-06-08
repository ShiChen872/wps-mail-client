import { app } from "electron";
import path from "path";
import fs from "fs";
import { config as loadDotenv } from "dotenv";

export interface AppConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  oauthScopes: string;
  apiBase: string;
  oauthAuthUrl: string;
  oauthTokenUrl: string;
  /** WPS 365 Web 邮箱页面（SPA），如 https://365.kdocs.cn/email/ */
  webMailUrl: string;
  /** Web 邮箱后端 API 根，如 https://email.wps.cn（与页面域名不同） */
  webMailApiBase: string;
  /** 写信时追加的签名（纯文本/HTML 片段，可选） */
  mailSignature: string;
  /** 云文档分享链接权限范围：company | anyone */
  cloudLinkScope: "company" | "anyone";
  /** 云文档分享角色 ID（公网常用 viewable / view_only，见开放平台权限角色列表） */
  cloudLinkRoleId: string;
  /** 分享链接有效期天数：0=永久，7，30 */
  cloudLinkExpireDays: number;
  /** WPS 365 云文档「最近」页，用于在浏览器中浏览完整云文档库 */
  cloudDocUrl: string;
}

function env(key: string, fallback = ""): string {
  return process.env[key]?.trim() ?? fallback;
}

/** 修正 .env 误写为 WPS_OAUTH_SCOPES=xxx 时整段被当成 scope 的问题 */
function sanitizeOAuthScopes(raw: string): string {
  let s = raw.trim();
  while (s.startsWith("WPS_OAUTH_SCOPES=")) {
    s = s.slice("WPS_OAUTH_SCOPES=".length).trim();
  }
  return s;
}

/** 在 dev / 打包后都能定位到项目根目录的 .env */
export function loadEnvFiles(): void {
  const candidates = [
    path.join(process.cwd(), ".env"),
    path.join(app.getAppPath(), ".env"),
    path.join(__dirname, "../../.env"),
    path.join(__dirname, "../../../.env"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      loadDotenv({ path: p, override: false });
    }
  }
  loadDotenv();
}

export function loadConfig(): AppConfig {
  const port = Number(env("WPS_OAUTH_PORT", "38473")) || 38473;
  const redirectUri =
    env("WPS_REDIRECT_URI") || `http://127.0.0.1:${port}/callback`;

  return {
    clientId: env("WPS_CLIENT_ID"),
    clientSecret: env("WPS_CLIENT_SECRET"),
    redirectUri,
    oauthScopes: sanitizeOAuthScopes(
      env(
        "WPS_OAUTH_SCOPES",
        "kso.user_base.read,kso.mailbox.read,kso.mail.readwrite,kso.drive.readwrite,kso.file.readwrite,kso.file_link.readwrite"
      )
    ),
    apiBase: env("WPS_API_BASE", "https://openapi.wps.cn"),
    oauthAuthUrl: env("WPS_OAUTH_AUTH_URL", "https://openapi.wps.cn/oauth2/auth"),
    oauthTokenUrl: env("WPS_OAUTH_TOKEN_URL", "https://openapi.wps.cn/oauth2/token"),
    webMailUrl: env("WPS_WEB_MAIL_URL", "https://365.kdocs.cn/email/"),
    webMailApiBase: env("WPS_WEB_MAIL_API_BASE", "https://email.wps.cn"),
    mailSignature: env("WPS_MAIL_SIGNATURE", ""),
    cloudLinkScope:
      env("WPS_CLOUD_LINK_SCOPE", "company") === "anyone"
        ? "anyone"
        : "company",
    cloudLinkRoleId: env("WPS_CLOUD_LINK_ROLE_ID", "viewable"),
    cloudLinkExpireDays: Number(env("WPS_CLOUD_LINK_EXPIRE_DAYS", "0")) || 0,
    cloudDocUrl: env("WPS_CLOUD_DOC_URL", "https://365.kdocs.cn/latest"),
  };
}

export function getDataDir(): string {
  return path.join(app.getPath("userData"), "wps-mail-data");
}

export function isConfigValid(cfg: AppConfig): boolean {
  return Boolean(cfg.clientId && cfg.clientSecret);
}
