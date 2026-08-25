import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { pool } from './pool.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const dbDir = path.resolve(here, '../../db');

export async function runSqlFile(name: string) {
  const file = path.join(dbDir, name);
  const sql = await readFile(file, 'utf8');
  console.log(`▶ running ${name}`);
  await pool.query(sql);
  console.log(`✔ ${name} applied`);
}
