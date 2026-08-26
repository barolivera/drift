import { useEffect, useRef, useState } from 'react';
import { ApiError, type PaymentStatus } from '@/lib/api';
import { useApi } from '@/hooks/useApi';

export interface PaymentStatusState {
  /** Payment status from the API: pending | processing | settled | failed | refunded. */
  status: PaymentStatus['status'] | null;
  /** Booking status once the backend confirmed it. */
  bookingStatus: PaymentStatus['booking_status'] | null;
  /** true once the payment is settled and the booking confirmed. */
  confirmed: boolean;
  /** true when the payment failed / was cancelled. */
  failed: boolean;
  error: string | null;
}

const TERMINAL = new Set<PaymentStatus['status']>(['settled', 'failed', 'refunded']);

/**
 * Polls GET /api/payments/:orderId every `intervalMs` (default 2s) until the
 * payment reaches a terminal state. Pass `null` to stop polling.
 *
 * A 404 right after placement is expected (the order row may land a moment
 * later), so the first few misses are tolerated silently.
 */
export function usePaymentStatus(orderId: string | null, intervalMs = 2000): PaymentStatusState {
  const call = useApi();
  const [state, setState] = useState<PaymentStatusState>({
    status: null,
    bookingStatus: null,
    confirmed: false,
    failed: false,
    error: null,
  });
  const misses = useRef(0);

  useEffect(() => {
    if (!orderId) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    misses.current = 0;
    setState({ status: null, bookingStatus: null, confirmed: false, failed: false, error: null });

    const tick = async () => {
      try {
        const p = await call<PaymentStatus>(`/api/payments/${encodeURIComponent(orderId)}`);
        if (stopped) return;
        misses.current = 0;
        const confirmed = p.status === 'settled' && p.booking_status === 'confirmed';
        setState({
          status: p.status,
          bookingStatus: p.booking_status,
          confirmed,
          failed: p.status === 'failed' || p.status === 'refunded',
          error: null,
        });
        if (TERMINAL.has(p.status)) return; // stop polling
      } catch (e) {
        if (stopped) return;
        if (e instanceof ApiError && e.status === 404 && misses.current < 5) {
          misses.current += 1; // order not registered yet — keep polling quietly
        } else {
          setState((s) => ({ ...s, error: e instanceof Error ? e.message : 'Could not read payment status' }));
        }
      }
      timer = setTimeout(tick, intervalMs);
    };

    void tick();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [orderId, intervalMs, call]);

  return state;
}
