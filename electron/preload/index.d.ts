import type { WpsMailApi } from "./index";

declare global {
  interface Window {
    wpsMail: WpsMailApi;
  }
}

export {};
