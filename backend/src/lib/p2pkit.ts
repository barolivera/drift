/**
 * p2pkit adapter — PIX <-> USDC on/off-ramp for Brazilian payments.
 *
 * This module isolates every call to the provider behind a small typed
 * interface so the rest of the app never touches HTTP details. Endpoint
 * paths below follow a conventional REST shape; adjust them to the exact
 * p2pkit API once credentials are in place (see backend/.env.example).
 *
 * Flow (PIX -> USDC, buyer pays in BRL, Drift receives USDC):
 *   1. createOrder()  -> provider returns a PIX QR/copy-paste code + BRL amount
 *   2. buyer pays via PIX
 *   3. provider POSTs webhook -> verifyWebhook() + handle in routes/payments.ts
 *   4. USDC is settled to DRIFT_TREASURY_ADDRESS, we mark payment 'settled'
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '../config/env.js';

export interface P2PQuote {
  amountUsdc: number;
  amountBrl: number;
  fxRate: number;            // BRL per USDC
  expiresAt: string;         // ISO
}

export interface P2POrder {
  orderId: string;
  status: 'pending' | 'processing' | 'settled' | 'failed' | 'expired';
  amountUsdc: number;
  amountBrl: number;
  fxRate: number;
  pixCode: string;           // copia-e-cola
  pixQrBase64?: string;
  expiresAt: string;
  txHash?: string;
  raw: unknown;
}

export interface CreateOrderInput {
  amountUsdc: number;
  reference: string;         // our payment id, echoed back in webhooks
  payerName?: string;
  payerTaxId?: string;       // CPF, if required by provider
  destinationAddress?: string;
}

export interface P2PWebhookEvent {
  orderId: string;
  status: P2POrder['status'];
  txHash?: string;
  reference?: string;
  raw: unknown;
}

export class P2PKitError extends Error {
  constructor(message: string, public readonly status?: number, public readonly body?: unknown) {
    super(message);
    this.name = 'P2PKitError';
  }
}

export const isP2PKitConfigured = () => Boolean(env.P2PKIT_API_KEY);

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!isP2PKitConfigured()) {
    throw new P2PKitError('P2PKIT_API_KEY not set — p2pkit integration is disabled');
  }
  const res = await fetch(`${env.P2PKIT_API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.P2PKIT_API_KEY}`,
      ...(init.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new P2PKitError(`p2pkit ${path} failed (${res.status})`, res.status, body);
  return body as T;
}

export const p2pkit = {
  async getQuote(amountUsdc: number): Promise<P2PQuote> {
    const data = await request<any>(`/v1/quotes`, {
      method: 'POST',
      body: JSON.stringify({ asset: env.P2PKIT_ASSET, chain: env.P2PKIT_CHAIN, fiat: 'BRL', amount: amountUsdc }),
    });
    return {
      amountUsdc,
      amountBrl: Number(data.fiatAmount),
      fxRate: Number(data.rate),
      expiresAt: data.expiresAt,
    };
  },

  async createOrder(input: CreateOrderInput): Promise<P2POrder> {
    const data = await request<any>(`/v1/orders`, {
      method: 'POST',
      body: JSON.stringify({
        side: 'buy',
        asset: env.P2PKIT_ASSET,
        chain: env.P2PKIT_CHAIN,
        fiat: 'BRL',
        amount: input.amountUsdc,
        destinationAddress: input.destinationAddress ?? env.DRIFT_TREASURY_ADDRESS,
        reference: input.reference,
        payer: input.payerName ? { name: input.payerName, taxId: input.payerTaxId } : undefined,
      }),
    });
    return normalizeOrder(data);
  },

  async getOrder(orderId: string): Promise<P2POrder> {
    const data = await request<any>(`/v1/orders/${encodeURIComponent(orderId)}`);
    return normalizeOrder(data);
  },

  /**
   * Validates the HMAC signature header on incoming webhooks.
   * rawBody must be the unparsed request body (see express.raw in routes/payments.ts).
   */
  verifyWebhook(rawBody: Buffer, signature: string | undefined): P2PWebhookEvent {
    if (!env.P2PKIT_WEBHOOK_SECRET) throw new P2PKitError('P2PKIT_WEBHOOK_SECRET not set');
    if (!signature) throw new P2PKitError('Missing webhook signature', 400);

    const expected = createHmac('sha256', env.P2PKIT_WEBHOOK_SECRET).update(rawBody).digest('hex');
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new P2PKitError('Invalid webhook signature', 401);
    }

    const data = JSON.parse(rawBody.toString('utf8'));
    return {
      orderId: String(data.orderId ?? data.id),
      status: data.status,
      txHash: data.txHash,
      reference: data.reference,
      raw: data,
    };
  },
};

function normalizeOrder(data: any): P2POrder {
  return {
    orderId: String(data.orderId ?? data.id),
    status: data.status,
    amountUsdc: Number(data.amount),
    amountBrl: Number(data.fiatAmount),
    fxRate: Number(data.rate),
    pixCode: data.pix?.code ?? data.pixCode,
    pixQrBase64: data.pix?.qrBase64 ?? data.pixQr,
    expiresAt: data.expiresAt,
    txHash: data.txHash,
    raw: data,
  };
}
