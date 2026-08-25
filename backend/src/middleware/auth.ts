import type { Request, Response, NextFunction } from 'express';
import { getPrivy } from '../lib/privy.js';
import { one, query } from '../db/pool.js';

export interface AuthUser {
  id: string;
  privy_did: string;
  email: string | null;
  wallet_address: string | null;
  display_name: string | null;
  is_host: boolean;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

function bearer(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7);
  return null;
}

/**
 * Verifies the Privy access token, upserts the user row and attaches it to req.user.
 * Frontend sends: Authorization: Bearer <await getAccessToken()>
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = bearer(req);
  if (!token) return res.status(401).json({ error: 'Missing bearer token' });

  try {
    const privy = getPrivy();
    const claims = await privy.verifyAuthToken(token);
    const did = claims.userId;

    let user = await one<AuthUser>(
      'SELECT id, privy_did, email, wallet_address, display_name, is_host FROM users WHERE privy_did = $1',
      [did],
    );

    if (!user) {
      // First login: pull profile from Privy and create the row.
      const profile = await privy.getUser(did);
      const email = profile.email?.address ?? profile.google?.email ?? null;
      const wallet = profile.wallet?.address ?? null;

      const rows = await query<AuthUser>(
        `INSERT INTO users (privy_did, email, wallet_address)
         VALUES ($1, $2, $3)
         ON CONFLICT (privy_did) DO UPDATE SET updated_at = now()
         RETURNING id, privy_did, email, wallet_address, display_name, is_host`,
        [did, email, wallet],
      );
      user = rows[0];
    }

    req.user = user;
    next();
  } catch (err) {
    console.warn('auth failed', err);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/** Like requireAuth but does not fail when no token is present. */
export async function optionalAuth(req: Request, res: Response, next: NextFunction) {
  if (!bearer(req)) return next();
  return requireAuth(req, res, next);
}

export function requireHost(req: Request, res: Response, next: NextFunction) {
  if (!req.user?.is_host) return res.status(403).json({ error: 'Host account required' });
  next();
}
