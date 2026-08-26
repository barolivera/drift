import { Router } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { env, isProd } from '../config/env.js';
import { one, withTransaction } from '../db/pool.js';

export const webhooksRouter = Router();

/**
 * Payload P2P.me (simulated) POSTs when an order changes state.
 *
 *   { orderId: "123", status: "completed", txHash: "0x…", amount: 4500 }
 *
 * `status` is normalised to lower-case; anything not in the map below is
 * recorded but does not change the booking.
 */
const webhookBody = z.object({
  orderId: z.union([z.string().min(1), z.number().int().nonnegative()]).transform(String),
  status: z.string().min(1).transform((s) => s.toLowerCase()),
  txHash: z.string().optional().nullable(),
  amount: z.number().nonnegative().optional().nullable(),
});

const STATUS_MAP: Record<string, 'settled' | 'failed' | 'processing'> = {
  completed: 'settled',
  settled: 'settled',
  cancelled: 'failed',
  canceled: 'failed',
  failed: 'failed',
  expired: 'failed',
  placed: 'processing',
  accepted: 'processing',
  paid: 'processing',
  processing: 'processing',
};

/**
 * Shared-secret check. When P2PKIT_WEBHOOK_SECRET is set the caller must send
 * it in `x-webhook-secret`. When unset: allowed in dev (with a warning),
 * rejected in production — never run an unauthenticated confirmer in prod.
 */
function authorised(header: string | undefined): boolean {
  const secret = env.P2PKIT_WEBHOOK_SECRET;
  if (!secret) {
    if (isProd) return false;
    console.warn('[webhook] P2PKIT_WEBHOOK_SECRET not set — accepting unauthenticated webhook (dev only)');
    return true;
  }
  if (!header) return false;
  const a = Buffer.from(secret);
  const b = Buffer.from(header);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * POST /webhooks/p2pkit
 *
 *  1. Validate payload + secret.
 *  2. Look the order up by `payments.p2pkit_order_id` (404 if unknown).
 *  3. completed → payment `settled` + booking `confirmed`
 *     cancelled/failed/expired → payment `failed` + booking `cancelled` (if still pending)
 *     anything else → payment `processing` (no booking change)
 *  4. Idempotent: replaying a webhook for an already-settled order is a no-op.
 */
webhooksRouter.post('/p2pkit', async (req, res) => {
  const received = { at: new Date().toISOString(), ip: req.ip, body: req.body };
  console.log('[webhook] p2pkit received', JSON.stringify(received));

  if (!authorised(req.header('x-webhook-secret'))) {
    console.warn('[webhook] rejected: bad or missing x-webhook-secret');
    return res.status(401).json({ success: false, error: 'Unauthorised' });
  }

  const parsed = webhookBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: parsed.error.flatten() });
  }
  const { orderId, status, txHash, amount } = parsed.data;

  const payment = await one<{ id: string; booking_id: string; status: string; amount_usdc: string }>(
    'SELECT id, booking_id, status, amount_usdc FROM payments WHERE p2pkit_order_id = $1',
    [orderId],
  );
  if (!payment) {
    console.warn(`[webhook] unknown orderId ${orderId}`);
    return res.status(404).json({ success: false, error: 'Order not found' });
  }

  const next = STATUS_MAP[status] ?? 'processing';
  const validTx = typeof txHash === 'string' && /^0x[0-9a-fA-F]{64}$/.test(txHash) ? txHash : null;

  if (amount != null && Number(payment.amount_usdc) !== amount) {
    console.warn(`[webhook] amount mismatch for ${orderId}: db=${payment.amount_usdc} webhook=${amount}`);
  }

  // Terminal states never regress (a late "processing" after "settled" is ignored).
  if (payment.status === 'settled' || (payment.status === 'failed' && next !== 'settled')) {
    console.log(`[webhook] ${orderId} already ${payment.status} — no-op`);
    return res.json({ success: true, orderId, payment_status: payment.status, changed: false });
  }

  const bookingStatus = await withTransaction(async (client) => {
    await client.query(
      `UPDATE payments SET status = $2, tx_hash = COALESCE($3, tx_hash),
              p2pkit_payload = COALESCE(p2pkit_payload, '{}'::jsonb) || $4::jsonb
       WHERE id = $1`,
      [payment.id, next, validTx, JSON.stringify({ webhook: received.body, receivedAt: received.at })],
    );
    if (next === 'settled') {
      const { rows } = await client.query(
        `UPDATE bookings SET status = 'confirmed' WHERE id = $1 AND status IN ('pending', 'confirmed') RETURNING status`,
        [payment.booking_id],
      );
      return rows[0]?.status ?? null;
    }
    if (next === 'failed') {
      const { rows } = await client.query(
        `UPDATE bookings SET status = 'cancelled' WHERE id = $1 AND status = 'pending' RETURNING status`,
        [payment.booking_id],
      );
      return rows[0]?.status ?? null;
    }
    const { rows } = await client.query('SELECT status FROM bookings WHERE id = $1', [payment.booking_id]);
    return rows[0]?.status ?? null;
  });

  console.log(`[webhook] ${orderId}: ${status} → payment ${next}, booking ${bookingStatus}`);
  res.json({ success: true, orderId, payment_status: next, booking_status: bookingStatus, changed: true });
});

/** Health check for the webhook receiver (P2P dashboards usually ping this). */
webhooksRouter.get('/p2pkit', (_req, res) => res.json({ ok: true, receiver: 'drift-p2pkit-webhook' }));

