import { Router } from 'express';
import { query, one } from '../db/pool.js';

export const spotsRouter = Router();

spotsRouter.get('/', async (_req, res) => {
  res.json(await query('SELECT * FROM spots ORDER BY name'));
});

spotsRouter.get('/:slug', async (req, res) => {
  const spot = await one('SELECT * FROM spots WHERE slug = $1', [req.params.slug]);
  if (!spot) return res.status(404).json({ error: 'Spot not found' });
  res.json(spot);
});
