/// <reference types="vite/client" />

interface Window {
  wpsMail: import("../electron/preload/index").WpsMailApi;
}

declare namespace Electron {
  interface App {
    isQuiting?: boolean;
  }
}
