import { Router } from 'express';
import { z } from 'zod';
import { query, one } from '../db/pool.js';
import { requireAuth, requireHost } from '../middleware/auth.js';

export const tripsRouter = Router();

const TRIP_SELECT = `
  SELECT t.*, ta.seats_left, ta.seats_taken,
         json_build_object('id', s.id, 'slug', s.slug, 'name', s.name, 'state', s.state, 'city', s.city, 'cover_url', s.cover_url) AS spot,
         json_build_object('id', u.id, 'display_name', u.display_name, 'avatar_url', u.avatar_url) AS host
  FROM trips t
  JOIN spots s ON s.id = t.spot_id
  JOIN users u ON u.id = t.host_id
  JOIN trip_availability ta ON ta.trip_id = t.id
`;

tripsRouter.get('/', async (req, res) => {
  const level = typeof req.query.level === 'string' ? req.query.level : null;
  const rows = await query(
    `${TRIP_SELECT}
     WHERE t.is_published AND t.ends_on >= CURRENT_DATE
       AND ($1::text IS NULL OR t.level = $1::surf_level OR t.level = 'all')
     ORDER BY t.starts_on ASC`,
    [level],
  );
  res.json(rows);
});

tripsRouter.get('/:id', async (req, res) => {
  const trip = await one(`${TRIP_SELECT} WHERE t.id = $1`, [req.params.id]);
  if (!trip) return res.status(404).json({ error: 'Trip not found' });
  res.json(trip);
});

const createTrip = z.object({
  spot_id: z.string().uuid(),
  title: z.string().min(3).max(120),
  description: z.string().max(4000).optional(),
  starts_on: z.string().date(),
  ends_on: z.string().date(),
  capacity: z.number().int().positive(),
  price_usdc: z.number().nonnegative(),
  includes: z.array(z.string()).default([]),
  level: z.enum(['beginner', 'intermediate', 'advanced', 'all']).default('all'),
  is_published: z.boolean().default(false),
});

tripsRouter.post('/', requireAuth, requireHost, async (req, res) => {
  const body = createTrip.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.flatten() });
  const d = body.data;
  const trip = await one(
    `INSERT INTO trips (host_id, spot_id, title, description, starts_on, ends_on, capacity, price_usdc, includes, level, is_published)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    [req.user!.id, d.spot_id, d.title, d.description, d.starts_on, d.ends_on, d.capacity, d.price_usdc, d.includes, d.level, d.is_published],
  );
  res.status(201).json(trip);
});
