import { Router, raw } from 'express';
import { z } from 'zod';
import { env } from '../config/env.js';
import { query, one } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { p2pkit, P2PKitError, isP2PKitConfigured } from '../lib/p2pkit.js';
import { readOrderSession, isIntegratorConfigured } from '../lib/integrator.js';
import { UsdcVerifyError, isUsdcConfigured, verifyUsdcTransfer } from '../lib/usdc.js';

export const paymentsRouter = Router();

/** Direct USDC payments are verified against BASE_SEPOLIA_RPC (see lib/usdc.ts). */
const USDC_CHAIN = 'base-sepolia';
/** How long an unknown tx hash keeps an intent in 'processing' before it is reopened. */
const UNKNOWN_TX_GRACE_MS = 5 * 60 * 1000;

/** Quote a trip price in BRL via p2pkit. */
paymentsRouter.get('/quote', requireAuth, async (req, res) => {
  const amount = Number(req.query.amount_usdc);
  if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: 'amount_usdc required' });
  if (!isP2PKitConfigured()) return res.status(503).json({ error: 'p2pkit not configured' });
  try {
    res.json(await p2pkit.getQuote(amount));
  } catch (err) {
    handleP2PError(err, res);
  }
});

const createPayment = z.object({
  booking_id: z.string().uuid(),
  method: z.enum(['usdc', 'pix_p2pkit']),
  payer_name: z.string().optional(),
  payer_tax_id: z.string().optional(),
});

/**
 * Start a payment for a booking.
 *  - usdc: returns treasury address + amount; client pays on-chain and POSTs /:id/confirm with tx_hash
 *  - pix_p2pkit: creates a p2pkit order and returns the PIX code
 */
paymentsRouter.post('/', requireAuth, async (req, res) => {
  const body = createPayment.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.flatten() });
  const { booking_id, method, payer_name, payer_tax_id } = body.data;

  const booking = await one<{ id: string; seats: number; price_usdc: string; status: string }>(
    `SELECT b.id, b.seats, b.status, t.price_usdc
     FROM bookings b JOIN trips t ON t.id = b.trip_id
     WHERE b.id = $1 AND b.user_id = $2`,
    [booking_id, req.user!.id],
  );
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  if (booking.status !== 'pending') return res.status(409).json({ error: `Booking is ${booking.status}` });

  const amountUsdc = Number(booking.price_usdc) * booking.seats;

  if (method === 'usdc') {
    if (!isUsdcConfigured()) return res.status(503).json({ error: 'USDC payments not configured' });
    // One open intent per booking: coming back to the pay screen reuses it.
    const open = await one<{ id: string; status: string; tx_hash: string | null }>(
      `SELECT id, status, tx_hash FROM payments WHERE booking_id = $1 AND method = 'usdc' AND status IN ('pending', 'processing')
       ORDER BY created_at DESC LIMIT 1`,
      [booking.id],
    );
    const payment =
      open ??
      (await one<{ id: string; status: string; tx_hash: string | null }>(
        `INSERT INTO payments (booking_id, method, amount_usdc, chain) VALUES ($1, 'usdc', $2, $3) RETURNING id, status, tx_hash`,
        [booking.id, amountUsdc, USDC_CHAIN],
      ));
    return res.status(open ? 200 : 201).json({
      payment_id: payment!.id,
      method,
      amount_usdc: amountUsdc,
      chain: USDC_CHAIN,
      token: env.USDC_ADDRESS,
      pay_to: env.DRIFT_TREASURY_ADDRESS,
      // resume: a hash already sent for this intent (refresh mid-verification)
      status: payment!.status,
      tx_hash: payment!.tx_hash,
    });
  }

  const payment = await one<{ id: string }>(
    `INSERT INTO payments (booking_id, method, amount_usdc, chain) VALUES ($1,$2,$3,$4) RETURNING id`,
    [booking.id, method, amountUsdc, env.P2PKIT_CHAIN],
  );

  if (!isP2PKitConfigured()) return res.status(503).json({ error: 'p2pkit not configured' });
  try {
    const order = await p2pkit.createOrder({
      amountUsdc,
      reference: payment!.id,
      payerName: payer_name,
      payerTaxId: payer_tax_id,
    });
    await query(
      `UPDATE payments SET p2pkit_order_id = $2, amount_brl = $3, fx_rate = $4, status = 'processing', p2pkit_payload = $5
       WHERE id = $1`,
      [payment!.id, order.orderId, order.amountBrl, order.fxRate, JSON.stringify(order.raw)],
    );
    res.status(201).json({
      payment_id: payment!.id,
      method,
      amount_usdc: amountUsdc,
      amount_brl: order.amountBrl,
      fx_rate: order.fxRate,
      pix_code: order.pixCode,
      pix_qr_base64: order.pixQrBase64,
      expires_at: order.expiresAt,
    });
  } catch (err) {
    await query(`UPDATE payments SET status = 'failed' WHERE id = $1`, [payment!.id]);
    handleP2PError(err, res);
  }
});

// ─── p2pkit widget flow (DriftIntegrator on Base) ────────────────────

const registerP2pOrder = z.object({
  booking_id: z.string().uuid(),
  order_id: z.string().min(1),
  tx_hash: z.string().regex(/^0x[a-fA-F0-9]{64}$/).nullable().optional(),
  amount_usdc: z.number().positive().optional(),
});

/**
 * Frontend placed a Diamond order via DriftIntegrator.bookTrip. Record it so
 * the booking can be reconciled with the on-chain lifecycle.
 */
paymentsRouter.post('/p2pkit', requireAuth, async (req, res) => {
  const body = registerP2pOrder.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.flatten() });
  const { booking_id, order_id, tx_hash, amount_usdc } = body.data;

  const booking = await one<{ id: string; seats: number; price_usdc: string; status: string }>(
    `SELECT b.id, b.seats, b.status, t.price_usdc
     FROM bookings b JOIN trips t ON t.id = b.trip_id
     WHERE b.id = $1 AND b.user_id = $2`,
    [booking_id, req.user!.id],
  );
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  if (booking.status !== 'pending') return res.status(409).json({ error: `Booking is ${booking.status}` });

  const amount = amount_usdc ?? Number(booking.price_usdc) * booking.seats;
  const payment = await one(
    `INSERT INTO payments (booking_id, method, status, amount_usdc, chain, tx_hash, p2pkit_order_id)
     VALUES ($1, 'pix_p2pkit', 'processing', $2, 'base-sepolia', $3, $4)
     ON CONFLICT (p2pkit_order_id) DO UPDATE SET updated_at = now()
     RETURNING id, booking_id, status, p2pkit_order_id, tx_hash`,
    [booking.id, amount, tx_hash ?? null, order_id],
  );
  res.status(201).json(payment);
});

/**
 * Widget reported COMPLETED. Verify against the integrator contract when
 * configured (session.status must be Paid), then settle + confirm the booking.
 */
paymentsRouter.post('/p2pkit/:orderId/complete', requireAuth, async (req, res) => {
  const orderId = req.params.orderId;
  const payment = await one<{ id: string; booking_id: string; status: string }>(
    `SELECT p.id, p.booking_id, p.status
     FROM payments p JOIN bookings b ON b.id = p.booking_id
     WHERE p.p2pkit_order_id = $1 AND b.user_id = $2`,
    [orderId, req.user!.id],
  );
  if (!payment) return res.status(404).json({ error: 'Order not found' });

  const isDemo = orderId.startsWith('demo'); // widget demo mode: `demo<timestamp>`
  if (!isDemo && isIntegratorConfigured()) {
    try {
      const session = await readOrderSession(orderId);
      if (session.status !== 'Paid') {
        return res.status(409).json({ error: `On-chain order is ${session.status}, not Paid` });
      }
    } catch (err) {
      console.error('integrator read failed', err);
      return res.status(502).json({ error: 'Could not verify order on-chain' });
    }
  } else if (!isDemo) {
    console.warn(`p2pkit order ${orderId} confirmed WITHOUT on-chain verification (DRIFT_INTEGRATOR_ADDRESS unset)`);
  }

  if (payment.status !== 'settled') {
    await query(`UPDATE payments SET status = 'settled' WHERE id = $1`, [payment.id]);
  }
  const booking = await one(
    `UPDATE bookings b SET status = 'confirmed'
     FROM trips t
     WHERE b.id = $1 AND t.id = b.trip_id AND b.status IN ('pending', 'confirmed')
     RETURNING b.*, t.title, t.starts_on, t.ends_on, t.price_usdc`,
    [payment.booking_id],
  );
  res.json(booking);
});

/**
 * Poll endpoint for the frontend: status of a p2pkit order (by Diamond orderId)
 * plus the booking it pays for. Scoped to the caller's own bookings.
 */
paymentsRouter.get('/:orderId', requireAuth, async (req, res) => {
  const row = await one(
    `SELECT p.id AS payment_id, p.status, p.amount_usdc, p.tx_hash, p.p2pkit_order_id AS order_id,
            p.updated_at, b.id AS booking_id, b.status AS booking_status
     FROM payments p JOIN bookings b ON b.id = p.booking_id
     WHERE p.p2pkit_order_id = $1 AND b.user_id = $2`,
    [req.params.orderId, req.user!.id],
  );
  if (!row) return res.status(404).json({ error: 'Order not found' });
  res.json(row);
});

/**
 * Direct USDC payment: the client paid on-chain and sends the tx hash. Nothing
 * is settled on trust — the receipt must show a Transfer of the configured
 * token, for the exact amount, to the treasury, from the guest's wallet
 * (see lib/usdc.ts). Responses:
 *   200 settled            booking confirmed (idempotent for the same hash)
 *   202 pending            not mined / not seen yet — poll again with the same hash
 *   422 <code>             the transaction does not pay for this booking
 *   409                    hash already used, or the payment is not open
 */
paymentsRouter.post('/:id/confirm', requireAuth, async (req, res) => {
  const tx = z.object({ tx_hash: z.string().regex(/^0x[a-fA-F0-9]{64}$/) }).safeParse(req.body);
  if (!tx.success) return res.status(400).json({ error: tx.error.flatten() });
  const txHash = tx.data.tx_hash.toLowerCase();

  const payment = await one<{
    id: string;
    booking_id: string;
    status: string;
    amount_usdc: string;
    tx_hash: string | null;
    updated_at: string;
    wallet_address: string | null;
  }>(
    `SELECT p.id, p.booking_id, p.status, p.amount_usdc, p.tx_hash, p.updated_at, u.wallet_address
     FROM payments p
     JOIN bookings b ON b.id = p.booking_id
     JOIN users u ON u.id = b.user_id
     WHERE p.id = $1 AND b.user_id = $2 AND p.method = 'usdc'`,
    [req.params.id, req.user!.id],
  );
  if (!payment) return res.status(404).json({ error: 'Payment not found' });

  if (payment.status === 'settled') {
    if (payment.tx_hash?.toLowerCase() !== txHash) return res.status(409).json({ error: 'Payment already settled with another transaction' });
    return res.json({ ok: true, status: 'settled', booking: await bookingById(payment.booking_id) });
  }
  if (payment.status !== 'pending' && payment.status !== 'processing') {
    return res.status(409).json({ error: `Payment is ${payment.status}` });
  }
  if (!isUsdcConfigured()) return res.status(503).json({ error: 'USDC payments not configured' });

  // A transaction pays for one booking only.
  const reused = await one<{ id: string }>(`SELECT id FROM payments WHERE lower(tx_hash) = $1 AND id <> $2`, [txHash, payment.id]);
  if (reused) return res.status(409).json({ error: 'This transaction was already used for another payment' });

  if (!payment.wallet_address) {
    console.warn(`usdc payment ${payment.id}: user has no wallet on file — sender check skipped`);
  }

  try {
    const verified = await verifyUsdcTransfer({
      txHash,
      amountUsdc: payment.amount_usdc,
      expectedFrom: payment.wallet_address,
    });
    await query(
      `UPDATE payments SET status = 'settled', tx_hash = $2, chain = $3, updated_at = now() WHERE id = $1`,
      [payment.id, txHash, USDC_CHAIN],
    );
    const booking = await one(
      `UPDATE bookings b SET status = 'confirmed'
       FROM trips t
       WHERE b.id = $1 AND t.id = b.trip_id AND b.status IN ('pending', 'confirmed')
       RETURNING b.*, t.title, t.starts_on, t.ends_on, t.price_usdc`,
      [payment.booking_id],
    );
    console.info(`usdc payment ${payment.id} settled: ${verified.value} units from ${verified.from} in block ${verified.blockNumber}`);
    return res.json({ ok: true, status: 'settled', booking });
  } catch (err) {
    if (err instanceof UsdcVerifyError) {
      if (err.retryable) {
        // A hash the network has never seen gets a grace period (RPC lag), then the
        // intent is reopened so the guest can pay again instead of polling forever.
        const sameHash = payment.tx_hash?.toLowerCase() === txHash;
        const ageMs = Date.now() - new Date(payment.updated_at).getTime();
        if (err.code === 'not_found' && sameHash && ageMs > UNKNOWN_TX_GRACE_MS) {
          await query(`UPDATE payments SET tx_hash = NULL, status = 'pending', updated_at = now() WHERE id = $1`, [payment.id]);
          return res.status(422).json({ ok: false, status: 'rejected', code: err.code, error: 'The transaction never reached the network' });
        }
        // Remember the hash so a refresh can keep polling; the booking stays pending.
        if (!sameHash) {
          await query(`UPDATE payments SET tx_hash = $2, status = 'processing', updated_at = now() WHERE id = $1`, [payment.id, txHash]);
        }
        return res.status(202).json({ ok: false, status: 'pending', code: err.code, error: err.message });
      }
      console.warn(`usdc payment ${payment.id} rejected (${err.code}): ${err.message} [${txHash}]`);
      return res.status(422).json({ ok: false, status: 'rejected', code: err.code, error: err.message });
    }
    console.error('usdc verification failed', err);
    return res.status(502).json({ ok: false, status: 'error', error: 'Could not verify the transaction on-chain right now' });
  }
});

async function bookingById(id: string) {
  return one(
    `SELECT b.*, t.title, t.starts_on, t.ends_on, t.price_usdc FROM bookings b JOIN trips t ON t.id = b.trip_id WHERE b.id = $1`,
    [id],
  );
}

/** p2pkit webhook. Mounted with raw body so the HMAC can be verified. */
paymentsRouter.post('/webhook/p2pkit', raw({ type: '*/*' }), async (req, res) => {
  try {
    const event = p2pkit.verifyWebhook(req.body as Buffer, req.header('x-p2pkit-signature'));
    const statusMap: Record<string, string> = {
      pending: 'pending', processing: 'processing', settled: 'settled', failed: 'failed', expired: 'failed',
    };
    const payment = await one<{ id: string; booking_id: string; status: string }>(
      `UPDATE payments SET status = $2, tx_hash = COALESCE($3, tx_hash), p2pkit_payload = $4
       WHERE p2pkit_order_id = $1 RETURNING id, booking_id, status`,
      [event.orderId, statusMap[event.status] ?? 'processing', event.txHash ?? null, JSON.stringify(event.raw)],
    );
    if (payment?.status === 'settled') {
      await query(`UPDATE bookings SET status = 'confirmed' WHERE id = $1`, [payment.booking_id]);
    }
    res.json({ received: true });
  } catch (err) {
    handleP2PError(err, res);
  }
});

function handleP2PError(err: unknown, res: import('express').Response) {
  if (err instanceof P2PKitError) {
    console.warn('p2pkit error', err.message, err.body);
    return res.status(err.status && err.status < 500 ? err.status : 502).json({ error: err.message });
  }
  console.error(err);
  res.status(500).json({ error: 'Internal error' });
}
