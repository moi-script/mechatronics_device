import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models';
import { COOKIE, cookieOptions, readUser, signToken, type AuthedRequest } from '../auth-middleware';

export const authRouter = Router();

const shape = (u: { _id: unknown; email: string; name: string }) => ({
  id: String(u._id),
  email: u.email,
  name: u.name,
});

authRouter.post('/register', async (req, res) => {
  const { email, password, name } = req.body ?? {};
  if (!email || !password || !name) {
    res.status(400).json({ error: 'Name, email and password are all required.' });
    return;
  }
  if (String(password).length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters.' });
    return;
  }
  const existing = await User.findOne({ email: String(email).toLowerCase() });
  if (existing) {
    res.status(409).json({ error: 'That email is already registered.' });
    return;
  }
  const user = await User.create({
    email: String(email).toLowerCase(),
    name,
    passwordHash: await bcrypt.hash(String(password), 10),
  });
  res.cookie(COOKIE, signToken(String(user._id)), cookieOptions);
  res.json({ user: shape(user) });
});

authRouter.post('/login', async (req, res) => {
  const { email, password } = req.body ?? {};
  const user = await User.findOne({ email: String(email ?? '').toLowerCase() });
  if (!user || !(await bcrypt.compare(String(password ?? ''), user.passwordHash))) {
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
