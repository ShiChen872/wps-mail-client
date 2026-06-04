import { shell } from "electron";
import type { TokenSet } from "@wps-mail/mail-api";
import type { AppConfig } from "./config";
import { WpsOAuthService } from "./oauth";
import { TokenStore } from "./token-store";

export class AuthService {
  private tokens: TokenSet | null;
  private oauth: WpsOAuthService;
  private refreshPromise: Promise<string> | null = null;

  constructor(
    private config: AppConfig,
    private store: TokenStore
  ) {
    this.tokens = store.load();
    this.oauth = new WpsOAuthService(config);
  }

  isLoggedIn(): boolean {
    return Boolean(this.tokens?.access_token);
  }

  getProfile(): { expiresAt: number } | null {
    if (!this.tokens) return null;
    return { expiresAt: this.tokens.expires_at };
  }

  async getAccessToken(): Promise<string | null> {
    if (!this.tokens) return null;
    if (Date.now() < this.tokens.expires_at) {
      return this.tokens.access_token;
    }
    return this.refreshAccessToken();
  }

  private async refreshAccessToken(): Promise<string | null> {
    if (!this.tokens?.refresh_token) return null;
    if (this.refreshPromise) return this.refreshPromise;

    this.refreshPromise = (async () => {
      const next = await this.oauth.refresh(this.tokens!.refresh_token);
      this.setTokens(next);
      return next.access_token;
    })();

    try {
      return await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  setTokens(tokens: TokenSet): void {
    this.tokens = tokens;
    this.store.save(tokens);
  }

  logout(): void {
    this.tokens = null;
    this.store.clear();
  }

  async login(): Promise<void> {
    const state = WpsOAuthService.newState();
    const authUrl = this.oauth.buildAuthorizeUrl(state);
    const codePromise = this.oauth.startCallbackServer(state);
    await shell.openExternal(authUrl);
    const code = await codePromise;
    const tokens = await this.oauth.exchangeCode(code);
    this.setTokens(tokens);
  }
}
