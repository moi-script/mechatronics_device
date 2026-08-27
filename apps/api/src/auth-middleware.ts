import jwt from 'jsonwebtoken';
import type { NextFunction, Request, Response } from 'express';
import { env } from './env';

export const COOKIE = 'mech_token';

export interface AuthedRequest extends Request {
  userId?: string;
}

export const signToken = (userId: string): string =>
  jwt.sign({ sub: userId }, env.jwtSecret, { expiresIn: '30d' });

/**
 * Session cookie. httpOnly keeps it away from scripts; SameSite blocks it from
 * riding along on cross-site requests unless the deployment genuinely needs it.
 */
export const cookieOptions = {
  httpOnly: true,
  sameSite: env.crossSiteCookies ? ('none' as const) : ('lax' as const),
  secure: env.isProd || env.crossSiteCookies,
  path: '/',
  maxAge: 30 * 24 * 60 * 60 * 1000,
};

/** Attaches userId when a valid token is present; never rejects. */
export function readUser(req: AuthedRequest, _res: Response, next: NextFunction): void {
  const token = req.cookies?.[COOKIE];
  if (token) {
    try {
      const payload = jwt.verify(token, env.jwtSecret) as { sub?: unknown };
      if (typeof payload.sub === 'string') req.userId = payload.sub;
    } catch {
      // Expired or tampered token: treat as signed out.
    }
  }
  next();
}

export function requireUser(req: AuthedRequest, res: Response, next: NextFunction): void {
  if (!req.userId) {
    res.status(401).json({ error: 'Sign in to do that.' });
    return;
  }
  next();
}
