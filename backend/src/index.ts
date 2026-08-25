import { env } from './config/env.js';
import { createApp } from './app.js';
import { pool } from './db/pool.js';
import { isPrivyConfigured } from './lib/privy.js';

if (!isPrivyConfigured()) {
  console.error('❌ PRIVY_APP_ID / PRIVY_APP_SECRET missing in backend/.env — get them at https://dashboard.privy.io');
  process.exit(1);
}

const app = createApp();

const server = app.listen(env.PORT, () => {
  console.log(`🏄 drift-api listening on http://localhost:${env.PORT}`);
});

async function shutdown(signal: string) {
  console.log(`\n${signal} received, shutting down…`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
