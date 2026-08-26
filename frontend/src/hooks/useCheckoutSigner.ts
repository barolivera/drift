import { useMemo } from 'react';
import { useSendTransaction, useWallets } from '@privy-io/react-auth';
import type { CheckoutSigner } from '@p2pdotme/widgets';

/**
 * Adapts the user's Privy wallet to the `CheckoutSigner` interface the p2pkit
 * widget expects. Embedded (Privy-managed) wallets request gas sponsorship —
 * enable it for Base Sepolia in the Privy dashboard, otherwise the wallet
 * needs its own testnet ETH.
 */
export function useCheckoutSigner(): CheckoutSigner | null {
  const { wallets } = useWallets();
  const { sendTransaction } = useSendTransaction();
  const wallet = wallets[0];

  return useMemo(() => {
    if (!wallet) return null;
    const isEmbedded = wallet.walletClientType === 'privy';
    return {
      address: wallet.address as `0x${string}`,
      sendTransaction: async (tx) => {
        const result = await sendTransaction(
          { to: tx.to, data: tx.data, gasLimit: tx.gasLimit ? BigInt(tx.gasLimit) : undefined },
          { address: wallet.address, ...(isEmbedded ? { sponsor: true } : {}) },
        );
        return { hash: result.hash as `0x${string}` };
      },
    };
  }, [wallet, sendTransaction]);
}
