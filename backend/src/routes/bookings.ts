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

const createBooking = z.object({
  trip_id: z.string().uuid(),
  seats: z.number().int().positive().default(1),
  notes: z.string().max(1000).optional(),
});

bookingsRouter.post('/', requireAuth, async (req, res) => {
  const body = createBooking.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.flatten() });
  const { trip_id, seats, notes } = body.data;

  try {
    const booking = await withTransaction(async (client) => {
      // Lock the trip row so concurrent bookings can't oversell.
      const { rows: [trip] } = await client.query(
        'SELECT capacity, is_published FROM trips WHERE id = $1 FOR UPDATE',
        [trip_id],
      );
      if (!trip || !trip.is_published) throw Object.assign(new Error('Trip not found'), { status: 404 });

      const { rows: [avail] } = await client.query(
        'SELECT seats_left FROM trip_availability WHERE trip_id = $1',
        [trip_id],
      );
      if (avail.seats_left < seats) throw Object.assign(new Error('Not enough seats'), { status: 409 });

      const { rows: [created] } = await client.query(
        `INSERT INTO bookings (trip_id, user_id, seats, notes) VALUES ($1,$2,$3,$4) RETURNING *`,
        [trip_id, req.user!.id, seats, notes ?? null],
      );
      return created;
    });
    res.status(201).json(booking);
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
