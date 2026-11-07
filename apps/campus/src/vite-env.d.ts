/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL WebSocket của server (wss://… khi deploy). Trống = ws://<hostname>:<DEFAULT_PORT>. */
  readonly VITE_SERVER_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
