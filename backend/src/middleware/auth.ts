/**
 * Auth middleware — verifies Supabase JWT and attaches user to request
 */
import { Request, Response, NextFunction } from 'express';
import { userScopedClient } from '../lib/supabase';

// Extend Express Request to carry the authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: { id: string; email?: string };
      authHeader?: string;
    }
  }
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.status(401).json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' });
    return;
  }

  try {
    const client = userScopedClient(authHeader);
    const { data: { user }, error } = await client.auth.getUser();

    if (error || !user) {
      res.status(401).json({ error: 'Unauthorized', code: 'INVALID_TOKEN' });
      return;
    }

    req.user = { id: user.id, email: user.email };
    req.authHeader = authHeader;
    next();
  } catch (err) {
    console.error('[auth] Unexpected error:', err);
    res.status(401).json({ error: 'Unauthorized', code: 'INVALID_TOKEN' });
  }
}
