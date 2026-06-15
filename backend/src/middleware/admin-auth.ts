import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';

/**
 * Express middleware that restricts access to admin-only routes.
 *
 * Checks `req.contractorId` (set by the auth middleware) against the
 * `ADMIN_USER_IDS` env var (comma-separated UUIDs).
 *
 * Must be mounted AFTER the auth middleware.
 */
export function adminAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const userId = req.contractorId;

  if (!userId) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  if (!env.adminUserIds.includes(userId)) {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }

  next();
}
