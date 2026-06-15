import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { env } from '../config/env';

/**
 * Express middleware that validates a Supabase JWT from the Authorization header
 * and attaches the contractor_id to the request.
 *
 * DEV BYPASS: When NODE_ENV !== 'production' and no Authorization header is
 * provided, auto-assigns the first ADMIN_USER_IDS entry as the contractor.
 * This allows the dev dashboard to work without any login.
 */
export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  // ── Dev bypass ────────────────────────────────────────
  // No auth header in non-production? Auto-assign admin user.
  if ((!authHeader || !authHeader.startsWith('Bearer ')) && env.nodeEnv !== 'production') {
    const devUserId = env.adminUserIds[0];
    if (devUserId) {
      req.contractorId = devUserId;
      next();
      return;
    }
  }

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }

    // The contractor_id is stored in the user's metadata or equals the user id.
    req.contractorId = user.id;
    next();
  } catch (err) {
    res.status(500).json({ error: 'Authentication check failed' });
  }
}
