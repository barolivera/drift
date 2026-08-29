/**
 * Dev helper: wipe a user's TEST bookings on one trip so the checkout can be
 * walked again from Details.
 *
 *   npm run db:reset-booking -- <trip> [--user <email>] [--dry-run] [--keep <bookingId>]
 *
 *   <trip>    trip id, or a case-insensitive part of its title ("rosa", "itamambuca")
 *   --user    the guest's email; optional when only one guest has bookings on the trip
 *   --dry-run list what would go, change nothing
 *   --keep    extra booking id(s) to leave alone (repeatable)
 *
 * Safety:
 *   · refuses to run against anything but a local database (NODE_ENV=production
 *     or a DATABASE_URL that is not localhost → exit 1)
 *   · never deletes a booking that has a real payment: a tx_hash, or an order
 *     id that isn't a demo one. Those are printed as "kept".
 *   · payments of the deleted bookings go with them (ON DELETE CASCADE)
 */
import { env } from '../config/env.js';
import { pool, query, withTransaction } from './pool.js';

type BookingRow = {
  id: string;
  status: string;
  email: string | null;
  user_email: string | null;
  created_at: string;
  real_payments: number;
  demo_payments: number;
};

function parseArgs(argv: string[]) {
  const keep = new Set<string>();
  let trip: string | undefined;
  let user: string | undefined;
  let dryRun = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') dryRun = true;
    else if (a === '--user') user = argv[++i];
    else if (a === '--keep') keep.add(argv[++i]);
    else if (a.startsWith('--')) throw new Error(`Unknown flag ${a}`);
    else if (!trip) trip = a;
    else throw new Error(`Unexpected argument ${a}`);
  }
  if (!trip) throw new Error('Usage: npm run db:reset-booking -- <trip> [--user <email>] [--dry-run] [--keep <bookingId>]');
  return { trip, user, dryRun, keep };
}

function assertLocalDatabase() {
  const host = new URL(env.DATABASE_URL).hostname;
  const local = host === 'localhost' || host === '127.0.0.1' || host === '::1';
  if (env.NODE_ENV === 'production' || !local) {
    throw new Error(`Refusing to reset bookings: this only runs against a local database (host=${host}, NODE_ENV=${env.NODE_ENV}).`);
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function main() {
  const { trip, user, dryRun, keep } = parseArgs(process.argv.slice(2));
  assertLocalDatabase();

  const trips = await query<{ id: string; title: string }>(
    UUID.test(trip) ? 'SELECT id, title FROM trips WHERE id = $1' : 'SELECT id, title FROM trips WHERE title ILIKE $1',
    [UUID.test(trip) ? trip : `%${trip}%`],
  );
  if (trips.length === 0) throw new Error(`No trip matches "${trip}"`);
  if (trips.length > 1) throw new Error(`"${trip}" matches several trips: ${trips.map((t) => `${t.title} (${t.id})`).join(', ')}`);
  const [t] = trips;

  const rows = await query<BookingRow>(
    `SELECT b.id, b.status, b.email, u.email AS user_email, b.created_at,
            COUNT(p.id) FILTER (WHERE p.tx_hash IS NOT NULL OR (p.p2pkit_order_id IS NOT NULL AND p.p2pkit_order_id NOT LIKE 'demo%'))::int AS real_payments,
            COUNT(p.id) FILTER (WHERE p.tx_hash IS NULL AND (p.p2pkit_order_id IS NULL OR p.p2pkit_order_id LIKE 'demo%'))::int AS demo_payments
       FROM bookings b
       JOIN users u ON u.id = b.user_id
       LEFT JOIN payments p ON p.booking_id = b.id
      WHERE b.trip_id = $1 AND ($2::text IS NULL OR u.email = $2)
      GROUP BY b.id, u.email
      ORDER BY b.created_at`,
    [t.id, user ?? null],
  );

  console.log(`Trip: ${t.title} (${t.id})`);
  if (rows.length === 0) {
    console.log(user ? `No bookings for ${user} on this trip — nothing to do.` : 'No bookings on this trip — nothing to do.');
    return;
  }
  const guests = new Set(rows.map((r) => r.user_email));
  if (!user && guests.size > 1) {
    throw new Error(`Several guests have bookings on this trip (${[...guests].join(', ')}). Pass --user <email>.`);
  }

  const kept = rows.filter((r) => r.real_payments > 0 || keep.has(r.id));
  const doomed = rows.filter((r) => !kept.includes(r));

  for (const r of kept) {
    const why = keep.has(r.id) ? '--keep' : `${r.real_payments} real payment(s)`;
    console.log(`  kept    ${r.id}  ${r.status.padEnd(9)}  ${r.user_email}  (${why})`);
  }
  for (const r of doomed) {
    console.log(`  ${dryRun ? 'would delete' : 'delete'}  ${r.id}  ${r.status.padEnd(9)}  ${r.user_email}  (${r.demo_payments} demo payment(s))`);
  }
  if (doomed.length === 0) {
    console.log('Nothing to delete.');
    return;
  }
  if (dryRun) {
    console.log(`Dry run — ${doomed.length} booking(s) would be deleted.`);
    return;
  }

  await withTransaction(async (client) => {
    const ids = doomed.map((r) => r.id);
    const { rowCount: payments } = await client.query('DELETE FROM payments WHERE booking_id = ANY($1::uuid[])', [ids]);
    const { rowCount: bookings } = await client.query('DELETE FROM bookings WHERE id = ANY($1::uuid[])', [ids]);
    console.log(`Deleted ${bookings} booking(s) and ${payments} payment row(s). /trips/${t.id}/book starts at Details again.`);
  });
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
