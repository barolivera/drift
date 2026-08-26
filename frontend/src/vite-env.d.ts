/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PRIVY_APP_ID: string;
  readonly VITE_API_URL: string;
  readonly VITE_CHAIN: string;
  readonly VITE_DRIFT_INTEGRATOR_ADDRESS?: string;
  readonly VITE_P2P_DIAMOND_ADDRESS?: string;
  readonly VITE_USDC_ADDRESS?: string;
  readonly VITE_P2P_SUBGRAPH_URL?: string;
  readonly VITE_P2P_BRL_CIRCLE_ID?: string;
  readonly VITE_P2P_DEMO?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
