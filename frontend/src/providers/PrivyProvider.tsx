import type { ReactNode } from 'react';
import { PrivyProvider } from '@privy-io/react-auth';
import { base, baseSepolia, polygon } from 'viem/chains';

const chains = { base, 'base-sepolia': baseSepolia, polygon } as const;
const defaultChain = chains[(import.meta.env.VITE_CHAIN as keyof typeof chains) ?? 'base'] ?? base;

export function AppPrivyProvider({ children }: { children: ReactNode }) {
  const appId = import.meta.env.VITE_PRIVY_APP_ID;
  if (!appId) {
    return (
      <div className="p-8 font-mono text-sm text-red-700">
        VITE_PRIVY_APP_ID is not set. Copy <code>frontend/.env.example</code> to <code>.env</code>.
      </div>
    );
  }

  return (
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ['email', 'wallet', 'google'],
        appearance: {
          theme: 'light',
          accentColor: '#1e9bc0',
          logo: undefined,
        },
        embeddedWallets: {
          ethereum: { createOnLogin: 'users-without-wallets' },
        },
        defaultChain,
        supportedChains: Object.values(chains),
      }}
    >
      {children}
    </PrivyProvider>
  );
}
