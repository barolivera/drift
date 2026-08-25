import { PrivyClient } from '@privy-io/server-auth';
import { env } from '../config/env.js';

let client: PrivyClient | null = null;

export function getPrivy(): PrivyClient {
  if (!client) {
    if (!env.PRIVY_APP_ID || !env.PRIVY_APP_SECRET) {
      throw new Error('PRIVY_APP_ID and PRIVY_APP_SECRET must be set in backend/.env');
    }
    client = new PrivyClient(env.PRIVY_APP_ID, env.PRIVY_APP_SECRET);
  }
  return client;
}

export const isPrivyConfigured = () => Boolean(env.PRIVY_APP_ID && env.PRIVY_APP_SECRET);
