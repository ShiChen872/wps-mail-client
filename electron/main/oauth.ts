import { randomBytes } from "crypto";
import http from "http";
import type { Server } from "http";
import { URL } from "url";
import type { AppConfig } from "./config";
import type { TokenSet } from "@wps-mail/mail-api";

export interface OAuthTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

interface PendingAuth {
  expectedState: string;
  resolve: (code: string) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

/** 单例 loopback 服务器，避免重复登录时 EADDRINUSE 与 state 错乱 */
class OAuthCallbackServer {
  private server: Server | null = null;
  private pending: PendingAuth | null = null;
  private port = 38473;
  private pathname = "/callback";

  configure(redirectUri: string): void {
    const redirect = new URL(redirectUri);
    this.port = Number(redirect.port) || 38473;
    this.pathname = redirect.pathname || "/callback";
  }

  private pathMatches(reqUrl: string | undefined): boolean {
    if (!reqUrl) return false;
    const pathOnly = reqUrl.split("?")[0].replace(/\/$/, "") || "/";
    const expected = this.pathname.replace(/\/$/, "") || "/";
    return pathOnly === expected;
  }

  private html(title: string, body: string): string {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title></head><body>${body}</body></html>`;
  }

  private failPending(err: Error): void {
    if (!this.pending) return;
    clearTimeout(this.pending.timer);
    const { reject } = this.pending;
    this.pending = null;
    reject(err);
  }

  ensureServer(): Promise<void> {
    if (this.server?.listening) return Promise.resolve();

    return new Promise((resolve, reject) => {
      if (this.server) {
        this.server.close();
        this.server = null;
      }

      const server = http.createServer((req, res) => {
        if (req.url === "/favicon.ico") {
          res.writeHead(204);
          res.end();
          return;
        }

        if (!this.pathMatches(req.url)) {
          res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
          res.end("Not Found");
          return;
        }

        const u = new URL(req.url!, `http://127.0.0.1:${this.port}`);
        const code = u.searchParams.get("code");
        const state = u.searchParams.get("state");
        const errParam = u.searchParams.get("error");
        const errDesc = u.searchParams.get("error_description");

        if (errParam) {
          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
          res.end(
            this.html(
              "授权失败",
              `<h2>授权失败</h2><p>${errParam}${errDesc ? `: ${errDesc}` : ""}</p>`
            )
          );
          this.failPending(new Error(errParam));
          return;
        }

        if (!this.pending) {
          res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
          res.end(
            this.html(
              "无效回调",
              "<h2>无效回调</h2><p>没有进行中的登录请求。请回到 WPS Mail 重新点击「使用 WPS 账号登录」。</p>"
            )
          );
          return;
        }

        if (!code) {
          res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
          res.end(
            this.html("无效回调", "<h2>无效回调</h2><p>未收到授权码 code。</p>")
          );
          this.failPending(new Error("OAuth 回调缺少 code"));
          return;
        }

        if (state !== this.pending.expectedState) {
          res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
          res.end(
            this.html(
              "无效回调",
              "<h2>无效回调</h2><p>state 不匹配（可能使用了过期的授权页）。请关闭此页，回到 WPS Mail 重新登录。</p>"
            )
          );
          this.failPending(new Error("OAuth state 不匹配，请重新登录"));
          return;
        }

        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(
          this.html(
            "授权成功",
            "<h2>授权成功</h2><p>可关闭此窗口，返回 WPS Mail。</p>"
          )
        );

        clearTimeout(this.pending.timer);
        const resolve = this.pending.resolve;
        this.pending = null;
        resolve(code);
      });

      server.on("error", (err: NodeJS.ErrnoException) => {
        if (err.code === "EADDRINUSE") {
          reject(
            new Error(
              `端口 ${this.port} 已被占用。请关闭其他 WPS Mail 进程，或在任务管理器中结束占用该端口的程序后重试。`
            )
          );
          return;
        }
        reject(err);
      });

      server.listen(this.port, "127.0.0.1", () => {
        this.server = server;
        resolve();
      });
    });
  }

  waitForCode(expectedState: string, timeoutMs = 5 * 60 * 1000): Promise<string> {
    if (this.pending) {
      this.failPending(new Error("已取消上一次登录"));
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pending) {
          this.pending = null;
          reject(new Error("授权超时（5 分钟），请重试"));
        }
      }, timeoutMs);

      this.pending = { expectedState, resolve, reject, timer };
    });
  }

  shutdown(): void {
    this.failPending(new Error("应用退出"));
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }
}

const callbackServer = new OAuthCallbackServer();

export class WpsOAuthService {
  constructor(private config: AppConfig) {
    callbackServer.configure(config.redirectUri);
  }

  buildAuthorizeUrl(state: string): string {
    const u = new URL(this.config.oauthAuthUrl);
    u.searchParams.set("response_type", "code");
    u.searchParams.set("client_id", this.config.clientId);
    u.searchParams.set("redirect_uri", this.config.redirectUri);
    u.searchParams.set("scope", this.config.oauthScopes);
    u.searchParams.set("state", state);
    return u.toString();
  }

  async exchangeCode(code: string): Promise<TokenSet> {
    const redirectUri = this.config.redirectUri;
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      code: code.trim(),
      redirect_uri: redirectUri,
    });

    const res = await fetch(this.config.oauthTokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    const text = await res.text();
    let json: OAuthTokens & { msg?: string; code?: number; data?: OAuthTokens };
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      throw new Error(`换取 token 失败：非 JSON 响应 (${res.status})`);
    }

    const tokens = json.access_token ? json : json.data;
    const bizCode = json.code;

    if (bizCode !== undefined && bizCode !== 0) {
      throw new Error(formatTokenError(json.msg ?? "换取 token 失败", redirectUri));
    }

    if (!res.ok || !tokens?.access_token) {
      throw new Error(
        formatTokenError(json.msg ?? `换取 token 失败 (HTTP ${res.status})`, redirectUri)
      );
    }

    return this.toTokenSet(tokens);
  }

  async refresh(refreshToken: string): Promise<TokenSet> {
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
    });

    const res = await fetch(this.config.oauthTokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    const json = (await res.json()) as OAuthTokens & { msg?: string };
    if (!res.ok || !json.access_token) {
      throw new Error(json.msg ?? `刷新 token 失败 (${res.status})`);
    }

    return this.toTokenSet(json);
  }

  private toTokenSet(json: OAuthTokens): TokenSet {
    const expiresIn = json.expires_in ?? 7200;
    return {
      access_token: json.access_token,
      refresh_token: json.refresh_token,
      token_type: json.token_type ?? "bearer",
      expires_at: Date.now() + expiresIn * 1000 - 60_000,
    };
  }

  async startCallbackServer(expectedState: string): Promise<string> {
    await callbackServer.ensureServer();
    return callbackServer.waitForCode(expectedState);
  }

  static newState(): string {
    return randomBytes(16).toString("hex");
  }

  static shutdownCallbackServer(): void {
    callbackServer.shutdown();
  }
}

function formatTokenError(msg: string, redirectUri: string): string {
  if (msg.includes("请求参数取值无效") || msg.includes("redirect")) {
    return (
      `${msg}。常见原因：\n` +
      `1) 开放平台「安全配置 → 授权回调地址」必须与 .env 中 WPS_REDIRECT_URI 完全一致（当前：${redirectUri}）\n` +
      `2) WPS_CLIENT_SECRET 应填应用 AppKey（不是 AppID）\n` +
      `3) 授权码 code 只能使用一次，请重新点击登录（勿刷新浏览器回调页）\n` +
      `4) scope 需在权限管理中申请并通过版本审核，可先用 WPS_OAUTH_SCOPES=kso.user_base.read 测试`
    );
  }
  return msg;
}
