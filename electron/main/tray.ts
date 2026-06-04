import { app, Menu, Tray, nativeImage } from "electron";

export function createTray(
  getUnread: () => number,
  showWindow: () => void
): Tray {
  const icon = nativeImage.createFromDataURL(
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAMElEQVQ4T2NkYGAwYqABYBzVMKoBBgZGhiEwG0Y1jGoY1TCqYVTDqIZRDaMaRjWMahjVMKoBAG5qB0p6nQ8nAAAAAElFTkSuQmCC"
  );

  const tray = new Tray(icon);
  tray.setToolTip("WPS Mail");

  const refreshMenu = () => {
    const unread = getUnread();
    const label = unread > 0 ? `打开 WPS Mail (${unread} 未读)` : "打开 WPS Mail";
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label, click: showWindow },
        { type: "separator" },
        {
          label: "退出",
          click: () => {
            tray.destroy();
            app.quit();
          },
        },
      ])
    );
  };

  tray.on("click", showWindow);
  refreshMenu();

  return tray;
}

export function updateTrayUnread(tray: Tray | null, count: number): void {
  if (!tray) return;
  tray.setToolTip(count > 0 ? `WPS Mail — ${count} 封未读` : "WPS Mail");
}
