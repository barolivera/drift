import pg from 'pg';
import { env, isProd } from '../config/env.js';

// DATE (OID 1082) → keep as 'YYYY-MM-DD'; pg's default turns it into a local-time Date.
pg.types.setTypeParser(1082, (v) => v);

export const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  ssl: isProd ? { rejectUnauthorized: false } : undefined,
  max: 10,
});

pool.on('error', (err) => {
  console.error('Unexpected pg pool error', err);
});

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const { rows } = await pool.query<T>(text, params);
  return rows;
}

export async function one<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

export async function withTransaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
