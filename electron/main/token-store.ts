import fs from "fs";
import path from "path";
import type { TokenSet } from "@wps-mail/mail-api";
import { getDataDir } from "./config";

const TOKEN_FILE = "tokens.json";

export class TokenStore {
  private filePath: string;

  constructor() {
    const dir = getDataDir();
    fs.mkdirSync(dir, { recursive: true });
    this.filePath = path.join(dir, TOKEN_FILE);
  }

  load(): TokenSet | null {
    try {
      if (!fs.existsSync(this.filePath)) return null;
      const raw = JSON.parse(fs.readFileSync(this.filePath, "utf8")) as TokenSet;
      if (!raw.access_token || !raw.refresh_token) return null;
      return raw;
    } catch {
      return null;
    }
  }

  save(tokens: TokenSet): void {
    fs.writeFileSync(this.filePath, JSON.stringify(tokens, null, 2), "utf8");
  }

  clear(): void {
    if (fs.existsSync(this.filePath)) fs.unlinkSync(this.filePath);
  }
}
