import { useCallback, useEffect, useRef, useState } from 'react';
import { createPublicClient, encodeFunctionData, erc20Abi, formatUnits, http } from 'viem';
import { baseSepolia } from 'viem/chains';
import { ApiError, formatUsdc, type Booking, type UsdcConfirmResponse, type UsdcPaymentIntent } from '@/lib/api';
import { useApi } from '@/hooks/useApi';
import { useCheckoutSigner } from '@/hooks/useCheckoutSigner';
import { P2P, usdcToUnits } from '@/lib/p2p';
import { WaitScreen } from '@/components/WaitScreen';

export type UsdcStage = 'pay' | 'verifying';

export interface UsdcCheckoutProps {
  booking: Booking;
  /** Trip price in USDC. */
  price: string | number;
  onStageChange?: (stage: UsdcStage) => void;
  /** The backend verified the transfer and confirmed the booking. */
  onSuccess: (booking: Booking) => void;
}

type State =
  | { kind: 'loading' }
  | { kind: 'ready'; balance: bigint }
  | { kind: 'sending'; balance: bigint }
  | { kind: 'verifying'; txHash: string }
  | { kind: 'error'; message: string; balance: bigint | null; retry: boolean };

const publicClient = createPublicClient({ chain: baseSepolia, transport: http() });
const POLL_MS = 3000;

const REJECT_MESSAGES: Record<string, string> = {
  wrong_amount: "The transfer amount doesn't match the price.",
  wrong_recipient: "The transfer didn't go to Drift's treasury.",
  wrong_sender: "The transfer didn't come from this wallet.",
  no_transfer: 'That transaction contains no USDC transfer.',
  reverted: 'The transaction reverted on-chain.',
  not_found: 'The transaction never reached the network. Try again.',
};

/**
 * Pay the seat by sending USDC from the connected wallet to Drift's treasury.
 *
 *   1. POST /api/payments { method: 'usdc' } → treasury address + amount
 *   2. ERC-20 transfer through the Privy wallet
 *   3. POST /api/payments/:id/confirm { tx_hash } until the backend has
 *      verified the transfer on-chain (202 = keep polling) → onSuccess
 *
 * Reloading mid-flight resumes at step 3: the intent remembers the hash.
 */
export function UsdcCheckout({ booking, price, onStageChange, onSuccess }: UsdcCheckoutProps) {
  const call = useApi();
  const signer = useCheckoutSigner();
  const [intent, setIntent] = useState<UsdcPaymentIntent | null>(null);
  const [state, setState] = useState<State>({ kind: 'loading' });
  const units = usdcToUnits(price);
  const done = useRef(false);

  useEffect(() => {
    onStageChange?.(state.kind === 'verifying' ? 'verifying' : 'pay');
  }, [state.kind, onStageChange]);

  // ── 1. intent + balance ────────────────────────────────────────────
  const loadBalance = useCallback(
    async (token: `0x${string}`) => {
      if (!signer) return 0n;
      return publicClient.readContract({ address: token, abi: erc20Abi, functionName: 'balanceOf', args: [signer.address] });
    },
    [signer],
  );

  useEffect(() => {
    if (!signer) return;
    let cancelled = false;
    (async () => {
      try {
        const i = await call<UsdcPaymentIntent>('/api/payments', { method: 'POST', body: { booking_id: booking.id, method: 'usdc' } });
        if (cancelled) return;
        setIntent(i);
        if (i.tx_hash) {
          setState({ kind: 'verifying', txHash: i.tx_hash });
          return;
        }
        const balance = await loadBalance((i.token || P2P.usdc) as `0x${string}`);
        if (!cancelled) setState({ kind: 'ready', balance });
      } catch (e) {
        if (!cancelled) setState({ kind: 'error', message: e instanceof Error ? e.message : 'Could not start the payment', balance: null, retry: false });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [signer, booking.id, call, loadBalance]);

  // ── 3. poll the backend until it has verified the transfer ─────────
  useEffect(() => {
    if (state.kind !== 'verifying' || !intent) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      try {
        const r = await call<UsdcConfirmResponse>(`/api/payments/${intent.payment_id}/confirm`, {
          method: 'POST',
          body: { tx_hash: state.txHash },
        });
        if (stopped) return;
        if (r.status === 'settled' && r.booking && !done.current) {
          done.current = true;
          onSuccess(r.booking);
          return;
        }
      } catch (e) {
        if (stopped) return;
        if (e instanceof ApiError && e.status === 202) {
          // not mined yet — keep going
        } else if (e instanceof ApiError && (e.status === 422 || e.status === 409)) {
          const body = (e.body ?? {}) as Partial<UsdcConfirmResponse> & { error?: string };
          const message = (body.code && REJECT_MESSAGES[body.code]) || body.error || e.message;
          setState({ kind: 'error', message, balance: null, retry: true });
          return;
        }
        // transient (network / 5xx): keep polling
      }
      timer = setTimeout(tick, POLL_MS);
    };
    void tick();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [state, intent, call, onSuccess]);

  // ── 2. send the transfer ───────────────────────────────────────────
  const pay = async () => {
    if (!signer || !intent || state.kind !== 'ready') return;
    const balance = state.balance;
    setState({ kind: 'sending', balance });
    try {
      const data = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'transfer',
        args: [intent.pay_to as `0x${string}`, units],
      });
      const { hash } = await signer.sendTransaction({ to: (intent.token || P2P.usdc) as `0x${string}`, data, gasLimit: 120_000 });
      setState({ kind: 'verifying', txHash: hash });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/reject|denied|cancel/i.test(msg)) {
        setState({ kind: 'error', message: 'Transaction cancelled — nothing was sent.', balance, retry: true });
      } else if (/insufficient|exceeds balance/i.test(msg)) {
        setState({ kind: 'error', message: 'Not enough USDC or ETH for gas in this wallet.', balance, retry: true });
      } else {
        setState({ kind: 'error', message: msg, balance, retry: true });
      }
    }
  };

  const retry = async () => {
    if (!intent || !signer) return;
    setState({ kind: 'loading' });
    const balance = await loadBalance((intent.token || P2P.usdc) as `0x${string}`);
    setState({ kind: 'ready', balance });
  };

  // ── render ─────────────────────────────────────────────────────────
  if (!signer) return <p className="text-sm text-mute">Connecting your wallet…</p>;
  if (state.kind === 'loading') return <p className="text-sm text-mute">Loading…</p>;

  if (state.kind === 'verifying') {
    return (
      <div>
        <WaitScreen title="Confirming your payment" body="Waiting for the transfer to be mined on Base. Usually under a minute." />
        <p className="label text-center normal-case text-mute">tx {state.txHash.slice(0, 10)}…{state.txHash.slice(-6)}</p>
      </div>
    );
  }

  const balance = state.kind === 'error' ? state.balance : state.balance;
  const short = `${signer.address.slice(0, 6)}…${signer.address.slice(-4)}`;
  const enough = balance !== null && balance >= units;

  return (
    <section className="card-line p-6 sm:p-8">
      <p className="label text-mute">Pay exactly</p>
      <p className="mt-1 text-[clamp(2rem,5vw,2.5rem)] font-bold leading-none tracking-tight text-ink">
        {formatUsdc(price)} <span className="text-lg font-semibold text-mute">USDC</span>
      </p>

      <dl className="mt-6 space-y-2 border-t border-line pt-5 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-mute">From your wallet</dt>
          <dd className="font-mono text-ink">{short}</dd>
        </div>
        {balance !== null && (
          <div className="flex justify-between gap-4">
            <dt className="text-mute">Balance</dt>
            <dd className={enough ? 'text-ink' : 'text-red-700'}>{formatUnits(balance, 6)} USDC</dd>
          </div>
        )}
        <div className="flex justify-between gap-4">
          <dt className="text-mute">Network</dt>
          <dd className="text-ink">Base Sepolia</dd>
        </div>
      </dl>

      {state.kind === 'error' && (
        <p className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{state.message}</p>
      )}
      {state.kind !== 'error' && !enough && (
        <p className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
          Not enough USDC in this wallet. You need {formatUsdc(price)} USDC on Base Sepolia.
        </p>
      )}

      {state.kind === 'error' && state.retry ? (
        <button type="button" onClick={retry} className="btn-primary btn-lg mt-6 w-full">
          Try again
        </button>
      ) : (
        <button
          type="button"
          onClick={pay}
          disabled={state.kind !== 'ready' || !enough}
          className="btn-primary btn-lg mt-6 w-full"
        >
          {state.kind === 'sending' ? 'Confirm in your wallet…' : `Pay ${formatUsdc(price)} USDC`}
        </button>
      )}
    </section>
  );
}
