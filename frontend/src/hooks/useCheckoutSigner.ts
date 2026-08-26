import { useMemo } from 'react';
import { useSendTransaction, useWallets } from '@privy-io/react-auth';
import type { CheckoutSigner } from '@p2pdotme/widgets';
import { P2P } from '@/lib/p2p';

/**
 * Adapts the user's Privy wallet to the `CheckoutSigner` interface the p2pkit
 * widget expects.
 *
 * Gas: by default the wallet pays its own gas (fund it with a little ETH on
 * Base Sepolia). Set VITE_PRIVY_GAS_SPONSORSHIP=true only once gas sponsorship
 * is enabled for this app in the Privy dashboard — otherwise Privy rejects the
 * transaction with "Gas sponsorship is not enabled".
 */
const SPONSOR_GAS = import.meta.env.VITE_PRIVY_GAS_SPONSORSHIP === 'true';
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
        // The checkout runs on Base Sepolia regardless of the app's default chain —
        // make sure the wallet signs there (Privy otherwise uses the wallet's current chain).
        await wallet.switchChain(P2P.chainId);
        const result = await sendTransaction(
          {
            to: tx.to,
            data: tx.data,
            chainId: P2P.chainId,
            gasLimit: tx.gasLimit ? BigInt(tx.gasLimit) : undefined,
          },
          { address: wallet.address, ...(isEmbedded && SPONSOR_GAS ? { sponsor: true } : {}) },
        );
        return { hash: result.hash as `0x${string}` };
      },
    };
  }, [wallet, sendTransaction]);
}
