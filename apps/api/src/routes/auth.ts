import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { User } from '../models';
import { COOKIE, cookieOptions, readUser, requireUser, signToken, type AuthedRequest } from '../auth-middleware';

export const authRouter = Router();

/** Credential endpoints get a much tighter budget than the rest of the API. */
const credentialLimit = rateLimit({
  windowMs: 15 * 60_000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: 'Too many attempts. Wait a few minutes and try again.' },
});

const email = z.string().trim().toLowerCase().email().max(254);
const password = z.string().min(8, 'Password must be at least 8 characters.').max(200);

const registerSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email,
  password,
});

const loginSchema = z.object({ email, password: z.string().min(1).max(200) });

const shape = (u: { _id: unknown; email: string; name: string }) => ({
  id: String(u._id),
  email: u.email,
  name: u.name,
});

authRouter.post('/register', credentialLimit, async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Check the details you entered.' });
    return;
  }
  const { name, email: address, password: secret } = parsed.data;

  if (await User.exists({ email: address })) {
    res.status(409).json({ error: 'That email is already registered.' });
    return;
  }

  const user = await User.create({ email: address, name, passwordHash: await bcrypt.hash(secret, 12) });
  res.cookie(COOKIE, signToken(String(user._id)), cookieOptions);
  res.status(201).json({ user: shape(user) });
});

authRouter.post('/login', credentialLimit, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(401).json({ error: 'Wrong email or password.' });
    return;
  }

  const user = await User.findOne({ email: parsed.data.email });
  // Compare even when the user is missing, so a timing difference does not
  // reveal which addresses are registered.
  const stored = user?.passwordHash ?? '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv';
  const ok = await bcrypt.compare(parsed.data.password, stored);

  if (!user || !ok) {
    res.status(401).json({ error: 'Wrong email or password.' });
    return;
  }

  res.cookie(COOKIE, signToken(String(user._id)), cookieOptions);
  res.json({ user: shape(user) });
});

authRouter.post('/logout', (_req, res) => {
  res.clearCookie(COOKIE, cookieOptions);
  res.json({ ok: true });
});

authRouter.get('/me', readUser, async (req: AuthedRequest, res) => {
  if (!req.userId) {
    res.json({ user: null });
    return;
  }
  const user = await User.findById(req.userId);
  res.json({ user: user ? shape(user) : null });
});

authRouter.delete('/me', readUser, requireUser, async (req: AuthedRequest, res) => {
  await User.deleteOne({ _id: req.userId });
  res.clearCookie(COOKIE, cookieOptions);
  res.json({ ok: true });
});
