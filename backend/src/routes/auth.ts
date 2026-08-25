import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { one } from '../db/pool.js';

export const authRouter = Router();

authRouter.get('/me', requireAuth, (req, res) => {
  res.json(req.user);
});

const updateMe = z.object({
  display_name: z.string().min(1).max(80).optional(),
  avatar_url: z.string().url().optional(),
  surf_level: z.enum(['beginner', 'intermediate', 'advanced', 'all']).optional(),
  wallet_address: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
});

authRouter.patch('/me', requireAuth, async (req, res) => {
  const body = updateMe.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.flatten() });

  const user = await one(
    `UPDATE users SET
       display_name   = COALESCE($2, display_name),
       avatar_url     = COALESCE($3, avatar_url),
       surf_level     = COALESCE($4, surf_level),
       wallet_address = COALESCE($5, wallet_address)
     WHERE id = $1
     RETURNING id, privy_did, email, wallet_address, display_name, avatar_url, surf_level, is_host`,
    [req.user!.id, body.data.display_name, body.data.avatar_url, body.data.surf_level, body.data.wallet_address],
  );
  res.json(user);
});
