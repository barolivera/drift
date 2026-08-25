/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PRIVY_APP_ID: string;
  readonly VITE_API_URL: string;
  readonly VITE_CHAIN: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
