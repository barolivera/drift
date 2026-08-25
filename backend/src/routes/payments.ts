import { Router, raw } from 'express';
import { z } from 'zod';
import { env } from '../config/env.js';
import { query, one } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { p2pkit, P2PKitError, isP2PKitConfigured } from '../lib/p2pkit.js';

export const paymentsRouter = Router();

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

  const payment = await one<{ id: string }>(
    `INSERT INTO payments (booking_id, method, amount_usdc, chain) VALUES ($1,$2,$3,$4) RETURNING id`,
    [booking.id, method, amountUsdc, env.P2PKIT_CHAIN],
  );

  if (method === 'usdc') {
    return res.status(201).json({
      payment_id: payment!.id,
      method,
      amount_usdc: amountUsdc,
      chain: env.P2PKIT_CHAIN,
      pay_to: env.DRIFT_TREASURY_ADDRESS,
    });
  }

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

/** Client-side USDC transfer confirmation. TODO: verify tx on-chain before settling. */
paymentsRouter.post('/:id/confirm', requireAuth, async (req, res) => {
  const tx = z.object({ tx_hash: z.string().regex(/^0x[a-fA-F0-9]{64}$/) }).safeParse(req.body);
  if (!tx.success) return res.status(400).json({ error: tx.error.flatten() });

  const payment = await one<{ id: string; booking_id: string }>(
    `UPDATE payments p SET tx_hash = $2, status = 'settled'
     FROM bookings b
     WHERE p.id = $1 AND p.booking_id = b.id AND b.user_id = $3 AND p.method = 'usdc' AND p.status = 'pending'
     RETURNING p.id, p.booking_id`,
    [req.params.id, tx.data.tx_hash, req.user!.id],
  );
  if (!payment) return res.status(404).json({ error: 'Payment not found' });
  await query(`UPDATE bookings SET status = 'confirmed' WHERE id = $1`, [payment.booking_id]);
  res.json({ ok: true });
});

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
