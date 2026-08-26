import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  DATABASE_URL: z.string().url(),
  // Validated lazily in lib/privy.ts so db scripts don't need them.
  PRIVY_APP_ID: z.string().optional().default(''),
  PRIVY_APP_SECRET: z.string().optional().default(''),
  P2PKIT_API_KEY: z.string().optional().default(''),
  P2PKIT_API_URL: z.string().url().default('https://api.p2p.me'),
  P2PKIT_WEBHOOK_SECRET: z.string().optional().default(''),
  P2PKIT_CHAIN: z.string().default('base'),
  P2PKIT_ASSET: z.string().default('USDC'),
  DRIFT_TREASURY_ADDRESS: z.string().optional().default(''),
  // On-chain integrator (backend/src/contracts). Used to verify p2pkit orders.
  DRIFT_INTEGRATOR_ADDRESS: z.string().optional().default(''),
  BASE_SEPOLIA_RPC: z.string().optional().default('https://sepolia.base.org'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';
