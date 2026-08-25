import { pool } from './pool.js';
import { runSqlFile } from './runSql.js';

runSqlFile('schema.sql')
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
