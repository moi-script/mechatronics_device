import jwt from 'jsonwebtoken';
import type { NextFunction, Request, Response } from 'express';

const SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-me';
export const COOKIE = 'mech_token';

export interface AuthedRequest extends Request {
  userId?: string;
}

export const signToken = (userId: string): string => jwt.sign({ sub: userId }, SECRET, { expiresIn: '30d' });

export const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  maxAge: 30 * 24 * 60 * 60 * 1000,
};

/** Attaches userId when a valid token is present; never rejects. */
export function readUser(req: AuthedRequest, _res: Response, next: NextFunction): void {
  const token = req.cookies?.[COOKIE];
  if (token) {
    try {
      const payload = jwt.verify(token, SECRET) as { sub: string };
      req.userId = payload.sub;
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
