import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { createPublicClient, encodeFunctionData, http, stringToHex } from 'viem';
import { baseSepolia } from 'viem/chains';
import { P2PError, parseOrderIdFromReceipt, type CheckoutSigner } from '@p2pdotme/widgets';
import { Checkout, type PlaceOrderContext, type PlaceOrderResult } from '@p2pdotme/widgets/checkout';
import { createLocalStorageRelayStore, createRelayIdentity } from '@p2pdotme/sdk/orders';
import { ApiError, type Booking } from '@/lib/api';
import { useApi } from '@/hooks/useApi';
import { useCheckoutSigner } from '@/hooks/useCheckoutSigner';
import { usePaymentStatus } from '@/hooks/usePaymentStatus';
import { CURRENCIES, DRIFT_INTEGRATOR_ABI, P2P, routingConfigured, usdcToUnits, uuidToBytes32 } from '@/lib/p2p';

export interface PaymentCheckoutProps {
  tripId: string;
  /** Trip price in USDC, e.g. "1200.00" or 1200. */
  price: string | number;
  productName?: string;
  /** Pending booking already created by <BookingForm>. When omitted the
   *  component creates/reuses one itself (legacy path). */
  booking?: Booking;
  /** Fired once the order reaches COMPLETED and the backend confirmed the booking. */
  onSuccess: (booking: Booking) => void;
  onCancel?: () => void;
}

type Phase = 'auth' | 'creating-booking' | 'ready' | 'confirming' | 'done' | 'error';

const publicClient = createPublicClient({ chain: baseSepolia, transport: http() });

/**
 * p2pkit checkout for a trip.
 *
 * Flow:
 *   1. Create (or reuse) a pending booking → we need its id before the tx,
 *      because DriftIntegrator.bookTrip(bookingId, …) records it on-chain.
 *   2. Render <Checkout>. On "Pay now" the widget calls `placeOrder`, where we
 *      send `bookTrip` through the user's Privy wallet and hand the orderId
 *      back; the widget then drives PIX → merchant → COMPLETED.
 *   3. We register the on-chain order with the backend right after placement
 *      (POST /api/payments/p2pkit) and confirm it on completion
 *      (POST /api/payments/p2pkit/:orderId/complete) → onSuccess(booking).
 *
 * Demo mode (VITE_P2P_DEMO=true): the widget skips `placeOrder` entirely,
 * generates a `demo<timestamp>` orderId and fakes the lifecycle (verified
 * against @p2pdotme/widgets 1.8.1 — the README's claim that placeOrder still
 * runs is outdated). That is why the backend registration lives in
 * `onOrderPlaced`, which fires in both modes.
 */
export function PaymentCheckout({ tripId, price, productName, booking: initialBooking, onSuccess, onCancel }: PaymentCheckoutProps) {
  const { ready, authenticated, login } = usePrivy();
  const call = useApi();
  const walletSigner = useCheckoutSigner();

  const [phase, setPhase] = useState<Phase>('auth');
  const [booking, setBooking] = useState<Booking | null>(initialBooking ?? null);
  const [error, setError] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const successFired = useRef(false);

  // Real-time confirmation: once an order is placed, poll the backend every 2s.
  // The backend flips the payment to `settled` either from the P2P webhook
  // (/webhooks/p2pkit) or from the widget's onComplete → /complete call.
  const payment = usePaymentStatus(orderId);

  const usdcAmount = useMemo(() => usdcToUnits(price), [price]);

  // Demo mode without a wallet: use a placeholder signer so the widget still renders.
  const signer: CheckoutSigner | null =
    walletSigner ??
    (P2P.demo
      ? {
          address: '0x0000000000000000000000000000000000000000',
          sendTransaction: async () => {
            throw new Error('Demo signer cannot send transactions');
          },
        }
      : null);

  // ── 1. booking ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!ready) return;
    if (!authenticated) {
      // Demo mode can run without a backend booking.
      if (P2P.demo) {
        setBooking({ id: '00000000-0000-4000-8000-000000000000', status: 'pending' } as Booking);
        setPhase('ready');
      } else {
        setPhase('auth');
      }
      return;
    }
    if (booking) {
      setPhase((p) => (p === 'auth' || p === 'creating-booking' ? 'ready' : p));
      return;
    }

    let cancelled = false;
    setPhase('creating-booking');
    setError(null);
    (async () => {
      try {
        const created = await call<Booking>('/api/bookings', { method: 'POST', body: { trip_id: tripId, seats: 1 } });
        if (!cancelled) {
          setBooking(created);
          setPhase('ready');
        }
      } catch (e) {
        // Already booked → reuse the pending booking for this trip.
        if (e instanceof ApiError && e.status === 409) {
          try {
            const mine = await call<Booking[]>('/api/bookings');
            const existing = mine.find((b) => b.trip_id === tripId && b.status === 'pending');
            if (existing && !cancelled) {
              setBooking(existing);
              setPhase('ready');
              return;
            }
            if (!cancelled) {
              setError('You already have a booking for this trip. Check "My bookings".');
              setPhase('error');
            }
            return;
          } catch (inner) {
            if (!cancelled) {
              setError(inner instanceof Error ? inner.message : 'Could not load your bookings');
              setPhase('error');
            }
            return;
          }
        }
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Could not create booking');
          setPhase('error');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, authenticated, booking, tripId, call]);

  // ── 2. placeOrder: send bookTrip through the user's wallet ─────────
  const placeOrder = useCallback(
    async (ctx: PlaceOrderContext): Promise<PlaceOrderResult> => {
      if (!booking) throw new Error('Booking not ready');
      if (!ctx.currency) throw new Error('Currency not selected');

      if (!P2P.integrator) throw new Error('VITE_DRIFT_INTEGRATOR_ADDRESS is not set');
      if (!walletSigner) throw new Error('Wallet not connected');
      if (ctx.currency.circleId === undefined) throw new Error('No merchant circle resolved for BRL');

      // Relay identity: the merchant encrypts their PIX details to this key.
      const store = createLocalStorageRelayStore();
      let identity = await store.get();
      if (!identity) {
        identity = createRelayIdentity();
        await store.set(identity);
      }

      const data = encodeFunctionData({
        abi: DRIFT_INTEGRATOR_ABI,
        functionName: 'bookTrip',
        args: [
          uuidToBytes32(booking.id),
          ctx.usdcAmount ?? usdcAmount,
          stringToHex(ctx.currency.symbol, { size: 32 }),
          ctx.currency.circleId,
          identity.publicKey,
          0n, // preferredPaymentChannelConfigId — let the Diamond choose
          0n, // fiatAmountLimit — no slippage cap
        ],
      });

      const { hash } = await walletSigner.sendTransaction({ to: P2P.integrator, data, gasLimit: 1_500_000 });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status === 'reverted') throw new Error('bookTrip transaction reverted');

      const orderId = parseOrderIdFromReceipt(receipt as any);
      if (!orderId) throw new Error('orderId missing from receipt');
      return { orderId, txHash: hash };
    },
    [booking, walletSigner, usdcAmount],
  );

  // ── 2b. order placed (real or demo) → register it with the backend ──
  const handleOrderPlaced = useCallback(
    async (orderId: string, txHash: string) => {
      console.info('[checkout] order placed', orderId, txHash);
      if (!authenticated || !booking) return;
      try {
        await call('/api/payments/p2pkit', {
          method: 'POST',
          body: {
            booking_id: booking.id,
            order_id: orderId,
            tx_hash: /^0x[0-9a-fA-F]{64}$/.test(txHash) ? txHash : null,
            amount_usdc: Number(price),
          },
        });
        setOrderId(orderId); // start polling only once the backend knows the order
      } catch (e) {
        // Don't break the payment flow; /complete will fail loudly if this never landed.
        console.error('[checkout] could not register order with backend', e);
      }
    },
    [authenticated, booking, call, price],
  );

  // ── 3a. webhook path: backend confirmed the booking → finish ───────
  useEffect(() => {
    if (!payment.confirmed || successFired.current || !booking) return;
    successFired.current = true;
    setPhase('done');
    const confirmedBooking = { ...booking, status: 'confirmed' as const };
    setBooking(confirmedBooking);
    onSuccess(confirmedBooking);
  }, [payment.confirmed, booking, onSuccess]);

  useEffect(() => {
    if (payment.failed && !successFired.current) {
      setError('Payment failed or was cancelled. Your seat is released — you can try again.');
    }
  }, [payment.failed]);

  // ── 3. completion → confirm with backend ───────────────────────────
  const handleComplete = useCallback(
    async (orderId: string) => {
      if (successFired.current) return;
      successFired.current = true;
      setPhase('confirming');
      try {
        if (authenticated && booking) {
          const confirmed = await call<Booking>(`/api/payments/p2pkit/${encodeURIComponent(orderId)}/complete`, {
            method: 'POST',
          });
          setBooking(confirmed);
          setPhase('done');
          onSuccess(confirmed);
        } else {
          // demo without login
          const fake = { ...(booking as Booking), status: 'confirmed' as const };
          setPhase('done');
          onSuccess(fake);
        }
      } catch (e) {
        successFired.current = false;
        setError(
          `Payment completed on-chain (order ${orderId}) but the booking could not be confirmed: ${
            e instanceof Error ? e.message : 'unknown error'
          }. Our team will reconcile it.`,
        );
        setPhase('error');
      }
    },
    [authenticated, booking, call, onSuccess],
  );

  const handleError = useCallback((err: unknown) => {
    if (err instanceof P2PError) {
      if (err.code === 'WALLET_USER_REJECTED') return; // user closed the wallet prompt — not an error
      console.error(`[checkout] ${err.code}`, err.hint ?? err.message);
      setError(err.userMessage);
      return;
    }
    console.error('[checkout]', err);
    setError(err instanceof Error ? err.message : 'Something went wrong');
  }, []);

  // ── render ─────────────────────────────────────────────────────────
  if (!ready) return <Status>Loading wallet…</Status>;

  if (phase === 'auth') {
    return (
      <div className="rounded-xl border border-sand-300/60 bg-sand-50 p-4 text-sm">
        <p className="text-ocean-700">Log in to pay for this trip.</p>
        <button onClick={login} className="mt-3 rounded-full bg-ocean-500 px-4 py-1.5 font-medium text-white hover:bg-ocean-700">
          Log in
        </button>
      </div>
    );
  }

  if (phase === 'creating-booking') return <Status>Reserving your seat…</Status>;
  if (phase === 'confirming') return <Status>Payment received — confirming your booking…</Status>;

  if (phase === 'error' && !booking) {
    return <ErrorBox message={error ?? 'Something went wrong'} onRetry={onCancel} />;
  }

  if (!signer) return <Status>Connecting your wallet…</Status>;

  if (!P2P.demo && !P2P.integrator) {
    return <ErrorBox message="Checkout is not configured (VITE_DRIFT_INTEGRATOR_ADDRESS missing)." />;
  }
  if (!P2P.demo && !routingConfigured) {
    return <ErrorBox message="Checkout is not configured: set VITE_P2P_SUBGRAPH_URL or VITE_P2P_BRL_CIRCLE_ID." />;
  }

  return (
    <div className="space-y-3">
      {P2P.demo && (
        <p className="rounded-lg bg-sand-100 px-3 py-2 text-xs text-ocean-700">
          Demo mode — no transaction is sent and the payment flow is simulated.
        </p>
      )}
      {error && <ErrorBox message={error} onRetry={() => setError(null)} />}
      {orderId && !payment.confirmed && !payment.failed && (
        <Status>
          Waiting for payment confirmation…
          {payment.status && <span className="ml-1 text-xs text-ocean-500">({payment.status})</span>}
        </Status>
      )}
      <Checkout
        mode="inline"
        demo={P2P.demo}
        signer={signer}
        placeOrder={placeOrder}
        currencies={CURRENCIES}
        amount={`${Number(price).toLocaleString()} USDC`}
        productName={productName ?? 'Drift trip'}
        chainId={P2P.chainId}
        diamondAddress={P2P.diamond}
        usdcAddress={P2P.usdc}
        usdcAmount={usdcAmount}
        subgraphUrl={P2P.subgraphUrl}
        onOrderPlaced={handleOrderPlaced}
        onComplete={handleComplete}
        onCancel={() => {
          setError('Order cancelled. Your seat is released — you can try again.');
          onCancel?.();
        }}
        onError={handleError}
        onClose={onCancel}
      />
    </div>
  );
}

function Status({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-sand-300/60 bg-white p-4 text-sm text-ocean-700">
      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-ocean-300 border-t-ocean-700" />
      {children}
    </div>
  );
}

function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
      <p>{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-2 text-red-700 underline">
          Dismiss
        </button>
      )}
    </div>
  );
}
