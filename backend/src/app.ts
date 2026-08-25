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

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN.split(','), credentials: true }));
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

  app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    res.status(500).json({ error: 'Internal error' });
  });

  return app;
}
