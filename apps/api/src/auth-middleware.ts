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

/**
 * The installed app has no cookie jar it can rely on — a Capacitor webview is
 * a different origin from the site, so the session cookie would be cross-site
 * and Android often drops it. It asks for a token instead and sends it back
 * itself, which is why this header exists alongside the cookie.
 */
export const APP_CLIENT = 'x-mech-client';
export const wantsToken = (req: Request): boolean => req.get(APP_CLIENT) === 'app';

/** The bearer token on a request, if it carries one. */
function bearer(req: Request): string | undefined {
  const header = req.get('authorization');
  return header?.startsWith('Bearer ') ? header.slice(7).trim() || undefined : undefined;
}

/** Attaches userId when a valid token is present; never rejects. */
export function readUser(req: AuthedRequest, _res: Response, next: NextFunction): void {
  const token = bearer(req) ?? req.cookies?.[COOKIE];
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
