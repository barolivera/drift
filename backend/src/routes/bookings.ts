import { Router } from 'express';
import { z } from 'zod';
import { query, one, withTransaction } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';

export const bookingsRouter = Router();

bookingsRouter.get('/', requireAuth, async (req, res) => {
  const rows = await query(
    `SELECT b.*, t.title, t.starts_on, t.ends_on, t.price_usdc,
            json_build_object('name', s.name, 'city', s.city, 'state', s.state) AS spot
     FROM bookings b
     JOIN trips t ON t.id = b.trip_id
     JOIN spots s ON s.id = t.spot_id
     WHERE b.user_id = $1
     ORDER BY t.starts_on DESC`,
    [req.user!.id],
  );
  res.json(rows);
});

/** One booking of the caller, with trip summary — used by the standalone booking page. */
bookingsRouter.get('/:id', requireAuth, async (req, res) => {
  if (!/^[0-9a-f-]{36}$/i.test(req.params.id)) return res.status(400).json({ error: 'Invalid booking id' });
  const booking = await one(
    `SELECT b.*, t.title, t.starts_on, t.ends_on, t.price_usdc, t.price_full_usdc, t.founding_seats,
            json_build_object('name', s.name, 'city', s.city, 'state', s.state) AS spot
     FROM bookings b
     JOIN trips t ON t.id = b.trip_id
     JOIN spots s ON s.id = t.spot_id
     WHERE b.id = $1 AND b.user_id = $2`,
    [req.params.id, req.user!.id],
  );
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  res.json(booking);
});

const trimmed = (max: number) => z.string().trim().min(1, 'Required').max(max);

/**
 * Registration form + reservation. Every field except `dietary`/`notes` is
 * required; zod reports the offending field in `error.fieldErrors`.
 */
export const createBooking = z.object({
  trip_id: z.string().uuid(),
  seats: z.number().int().positive().default(1),
  notes: z.string().max(1000).optional(),
  full_name: trimmed(120),
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  telegram: z
    .string()
    .trim()
    .transform((v) => v.replace(/^@+/, ''))
    .pipe(z.string().min(1, 'Required').max(64).regex(/^[A-Za-z0-9_]+$/, 'Letters, numbers and _ only')),
  country: trimmed(80),
  surf_level: z.enum(['never', 'beginner', 'intermediate', 'advanced']),
  working_on: trimmed(280),
  dietary: z.string().trim().max(500).optional().or(z.literal('')),
  agreed_terms: z.literal(true, { errorMap: () => ({ message: 'You must agree to the Code of Conduct and Terms' }) }),
});

bookingsRouter.post('/', requireAuth, async (req, res) => {
  const body = createBooking.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.flatten() });
  const { trip_id, seats, notes, full_name, email, telegram, country, surf_level, working_on, dietary } = body.data;

  try {
    const { booking, created } = await withTransaction(async (client) => {
      // Lock the trip row so concurrent bookings can't oversell.
      const { rows: [trip] } = await client.query(
        'SELECT capacity, is_published FROM trips WHERE id = $1 FOR UPDATE',
        [trip_id],
      );
      if (!trip || !trip.is_published) throw Object.assign(new Error('Trip not found'), { status: 404 });

      // An existing reservation for this user+trip: refresh the form data if it
      // is still pending (user came back to pay); otherwise it's a duplicate.
      const { rows: [existing] } = await client.query(
        'SELECT id, status FROM bookings WHERE trip_id = $1 AND user_id = $2',
        [trip_id, req.user!.id],
      );
      if (existing) {
        if (existing.status !== 'pending') {
          throw Object.assign(new Error('You already booked this trip'), { status: 409 });
        }
        const { rows: [updated] } = await client.query(
          `UPDATE bookings SET full_name = $2, email = $3, telegram = $4, country = $5, surf_level = $6,
                  working_on = $7, dietary = $8, agreed_terms_at = now(), notes = COALESCE($9, notes)
           WHERE id = $1 RETURNING *`,
          [existing.id, full_name, email, telegram, country, surf_level, working_on, dietary || null, notes ?? null],
        );
        return { booking: updated, created: false };
      }

      const { rows: [avail] } = await client.query(
        'SELECT seats_left FROM trip_availability WHERE trip_id = $1',
        [trip_id],
      );
      if (avail.seats_left < seats) throw Object.assign(new Error('Not enough seats'), { status: 409 });

      const { rows: [row] } = await client.query(
        `INSERT INTO bookings (trip_id, user_id, seats, notes, full_name, email, telegram, country, surf_level,
                               working_on, dietary, agreed_terms_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, now()) RETURNING *`,
        [trip_id, req.user!.id, seats, notes ?? null, full_name, email, telegram, country, surf_level, working_on, dietary || null],
      );
      return { booking: row, created: true };
    });
    res.status(created ? 201 : 200).json(booking);
  } catch (err: any) {
    if (err?.code === '23505') return res.status(409).json({ error: 'You already booked this trip' });
    res.status(err?.status ?? 500).json({ error: err?.message ?? 'Booking failed' });
  }
});

bookingsRouter.post('/:id/cancel', requireAuth, async (req, res) => {
  const booking = await one(
    `UPDATE bookings SET status = 'cancelled'
     WHERE id = $1 AND user_id = $2 AND status IN ('pending', 'confirmed')
     RETURNING *`,
    [req.params.id, req.user!.id],
  );
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  res.json(booking);
});
