import { app, BrowserWindow, shell } from "electron";
import path from "path";
import { loadConfig, loadEnvFiles } from "./config";
import { WpsOAuthService } from "./oauth";
import { TokenStore } from "./token-store";
import { AuthService } from "./auth-service";
import { MailDatabase } from "./db";
import { SyncService } from "./sync-service";
import { registerIpcHandlers } from "./ipc";
import { createTray, updateTrayUnread } from "./tray";

loadEnvFiles();

let mainWindow: BrowserWindow | null = null;
let tray: ReturnType<typeof createTray> | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: "WPS Mail",
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL);
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    win.loadFile(path.join(__dirname, "../renderer/index.html"));
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) {
      void shell.openExternal(url);
    }
    return { action: "deny" };
  });

  win.webContents.on("will-navigate", (event, url) => {
    const current = win.webContents.getURL();
    if (url !== current && /^https?:\/\//i.test(url)) {
      event.preventDefault();
      void shell.openExternal(url);
    }
  });

  win.on("close", (e) => {
    if (process.platform === "win32" && !app.isQuiting) {
      e.preventDefault();
      win.hide();
    }
  });

  return win;
}

function showWindow(): void {
  if (!mainWindow) mainWindow = createWindow();
  mainWindow.show();
  mainWindow.focus();
}

app.isQuiting = false;

app.whenReady().then(async () => {
  const config = loadConfig();
  const tokenStore = new TokenStore();
  const auth = new AuthService(config, tokenStore);
  const db = new MailDatabase();
  if (db.getSyncState("cache_version") !== "2") {
    db.clearMessages();
    db.setSyncState("cache_version", "2");
  }
  const sync = new SyncService(auth, db, config.apiBase);

  let unread = 0;
  const primaryId = db.getSyncState("primary_mailbox_id");
  if (primaryId && auth.isLoggedIn()) {
    unread = db.countUnreadInbox(primaryId);
    try {
      await sync.syncInboxQuick(primaryId);
      unread = db.countUnreadInbox(primaryId);
    } catch {
      /* offline */
    }
  }

  registerIpcHandlers(auth, db, sync, config, (count) => {
    unread = count;
    updateTrayUnread(tray, count);
  });

  mainWindow = createWindow();
  tray = createTray(() => unread, showWindow);
  updateTrayUnread(tray, unread);

  if (auth.isLoggedIn() && primaryId) {
    pollTimer = setInterval(() => {
      void (async () => {
        try {
          const prev = db.countUnreadInbox(primaryId);
          db.setFolderPageToken(primaryId, "inbox", null);
          await sync.syncFolderPage(primaryId, "inbox", { reset: true });
          const next = db.countUnreadInbox(primaryId);
          if (next > prev) {
            const { Notification } = await import("electron");
            if (Notification.isSupported()) {
              new Notification({
                title: "WPS Mail",
                body: `您有 ${next - prev} 封新邮件`,
              }).show();
            }
          }
          unread = next;
          updateTrayUnread(tray, next);
          mainWindow?.webContents.send("mail:unreadChanged", next);
        } catch {
          /* ignore network errors */
        }
      })();
    }, 120_000);
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow();
    } else {
      showWindow();
    }
  });
});

app.on("before-quit", () => {
  app.isQuiting = true;
  if (pollTimer) clearInterval(pollTimer);
  WpsOAuthService.shutdownCallbackServer();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    /* keep running in tray on Windows */
  }
});
