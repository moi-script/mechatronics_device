import { Router, type Response } from 'express';
import { randomInt } from 'node:crypto';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { canSendMail, sendResetCode } from '../mail';
import { Circuit, User } from '../models';
import {
  COOKIE,
  cookieOptions,
  readUser,
  requireUser,
  signToken,
  wantsToken,
  type AuthedRequest,
} from '../auth-middleware';

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

/**
 * Hand back a session: the cookie for the website, and for the installed app
 * the same token in the body, since it has to carry its own. Only a client
 * that says it is the app is given the token, so the website's session stays
 * where scripts cannot read it.
 */
function grant(req: Parameters<typeof wantsToken>[0], res: Response, userId: string): { token?: string } {
  const token = signToken(userId);
  res.cookie(COOKIE, token, cookieOptions);
  return wantsToken(req) ? { token } : {};
}

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
  res.status(201).json({ user: shape(user), ...grant(req, res, String(user._id)) });
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

  res.json({ user: shape(user), ...grant(req, res, String(user._id)) });
});

const RESET_MINUTES = 15;
const RESET_TRIES = 5;

/**
 * Emails a six-digit code rather than a link, so the same flow works in the
 * installed app, which has no page a link could open. The answer is the same
 * whether or not the address is registered, so this cannot be used to find out.
 */
authRouter.post('/forgot', credentialLimit, async (req, res) => {
  const parsed = z.object({ email }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Enter the email you registered with.' });
    return;
  }
  if (!canSendMail()) {
    res.status(503).json({ error: 'Password reset is not available right now.' });
    return;
  }

  const user = await User.findOne({ email: parsed.data.email });
  if (user) {
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    user.reset = {
      codeHash: await bcrypt.hash(code, 10),
      expires: new Date(Date.now() + RESET_MINUTES * 60_000),
      tries: 0,
    };
    await user.save();
    try {
      await sendResetCode(user.email, code);
    } catch (err) {
      console.error('[mail]', err);
      res.status(502).json({ error: 'The email could not be sent. Try again in a moment.' });
      return;
    }
  }
  res.json({ ok: true });
});

const resetSchema = z.object({ email, code: z.string().trim().regex(/^\d{6}$/, 'The code is six digits.'), password });

authRouter.post('/reset', credentialLimit, async (req, res) => {
  const parsed = resetSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Check the details you entered.' });
    return;
  }

  const bad = () => res.status(400).json({ error: 'That code is wrong or has expired. Ask for a new one.' });
  const user = await User.findOne({ email: parsed.data.email });
  const pending = user?.reset;
  if (!user || !pending || pending.expires < new Date() || pending.tries >= RESET_TRIES) {
    bad();
    return;
  }

  if (!(await bcrypt.compare(parsed.data.code, pending.codeHash))) {
    // Counted on the account, not the caller, so spreading guesses over many
    // addresses cannot outrun it.
    await User.updateOne({ _id: user._id }, { $inc: { 'reset.tries': 1 } });
    bad();
    return;
  }

  user.passwordHash = await bcrypt.hash(parsed.data.password, 12);
  user.reset = undefined;
  await user.save();
  res.json({ user: shape(user), ...grant(req, res, String(user._id)) });
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
  // Circuits go with the account. Leaving them behind would keep any share
  // link the account had published readable forever.
  await Circuit.deleteMany({ ownerId: req.userId });
  await User.deleteOne({ _id: req.userId });
  res.clearCookie(COOKIE, cookieOptions);
  res.json({ ok: true });
});
