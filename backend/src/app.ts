import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env, isProd } from './config/env.js';
import { authRouter } from './routes/auth.js';
import { tripsRouter } from './routes/trips.js';
import { bookingsRouter } from './routes/bookings.js';
import { paymentsRouter } from './routes/payments.js';
import { spotsRouter } from './routes/spots.js';
import { webhooksRouter } from './routes/webhooks.js';

/**
 * CORS_ORIGIN is a comma-separated list. An entry like `*.vercel.app` allows
 * any origin ending in `.vercel.app` (preview deployments); everything else
 * must match exactly. Requests without an Origin (curl, health checks) pass.
 */
function corsOrigin(list: string): cors.CorsOptions['origin'] {
  const entries = list.split(',').map((s) => s.trim()).filter(Boolean);
  const exact = new Set(entries.filter((e) => !e.startsWith('*.')));
  const suffixes = entries.filter((e) => e.startsWith('*.')).map((e) => e.slice(1)); // ".vercel.app"
  return (origin, cb) => {
    if (!origin) return cb(null, true);
    let host = '';
    try {
      host = new URL(origin).hostname;
    } catch {
      return cb(null, false);
    }
    const ok = exact.has(origin) || suffixes.some((s) => host.endsWith(s));
    cb(null, ok);
  };
}

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: corsOrigin(env.CORS_ORIGIN), credentials: true }));
  app.use(morgan(isProd ? 'combined' : 'dev'));

  // Webhook needs the raw body — mount it before express.json().
  app.use('/api/payments/webhook', paymentsRouter);
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (_req, res) => res.json({ ok: true, service: 'drift-api' }));

  app.use('/api/auth', authRouter);
  app.use('/api/spots', spotsRouter);
  app.use('/api/trips', tripsRouter);
  app.use('/api/bookings', bookingsRouter);
  app.use('/api/payments', paymentsRouter);

  // Inbound webhooks (P2P.me order lifecycle). No user auth — guarded by a
  // shared secret inside the router. Every hit is logged with its body.
  app.use('/webhooks', (req, _res, next) => {
    console.log(`[webhook] ${req.method} ${req.originalUrl} from ${req.ip}`);
    next();
  }, webhooksRouter);

  app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    res.status(500).json({ error: 'Internal error' });
  });

  return app;
}
