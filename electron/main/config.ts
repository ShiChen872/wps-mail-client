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
  /** WPS 365 Web 邮箱地址，用于「在浏览器中打开」 */
  webMailUrl: string;
}

function env(key: string, fallback = ""): string {
  return process.env[key]?.trim() ?? fallback;
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
    oauthScopes: env(
      "WPS_OAUTH_SCOPES",
      "kso.user_base.read,kso.mailbox.read,kso.mail.readwrite"
    ),
    apiBase: env("WPS_API_BASE", "https://openapi.wps.cn"),
    oauthAuthUrl: env("WPS_OAUTH_AUTH_URL", "https://openapi.wps.cn/oauth2/auth"),
    oauthTokenUrl: env("WPS_OAUTH_TOKEN_URL", "https://openapi.wps.cn/oauth2/token"),
    webMailUrl: env("WPS_WEB_MAIL_URL", "https://mail.wps.cn"),
  };
}

export function getDataDir(): string {
  return path.join(app.getPath("userData"), "wps-mail-data");
}

export function isConfigValid(cfg: AppConfig): boolean {
  return Boolean(cfg.clientId && cfg.clientSecret);
}
