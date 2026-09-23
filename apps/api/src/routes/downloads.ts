import { createHash } from 'node:crypto';
import { Router, type Request } from 'express';
import rateLimit from 'express-rate-limit';
import { dbReady } from '../db';
import { Counter, DownloadHit } from '../models';

export const downloadsRouter = Router();

/** The one tally this router keeps. */
const TALLY = 'apk-downloads';

/**
 * Enough to recognise the same person coming back today, and nothing more.
 * The address and browser go in, a hash comes out, and only the hash is
 * stored — so the count can tell a repeat from a new download without the
 * database ever holding who either of them was.
 *
 * The day is part of it deliberately. Someone downloading again next week is
 * a real download: they are taking a newer build, or putting it on a second
 * phone. Someone tapping twice in a minute is not.
 */
function fingerprint(req: Request): string {
  const day = new Date().toISOString().slice(0, 10);
  return createHash('sha256')
    .update([req.ip ?? '', req.headers['user-agent'] ?? '', day].join('|'))
    .digest('hex');
}

/** The tally as it stands, or null when the database cannot be reached. */
async function tally(): Promise<number | null> {
  if (!dbReady()) return null;
  try {
    const doc = await Counter.findById(TALLY).lean();
    return doc?.count ?? 0;
  } catch {
    return null;
  }
}

downloadsRouter.get('/downloads', async (_req, res) => {
  res.json({ count: await tally() });
});

downloadsRouter.post(
  '/downloads',
  // A download is a deliberate act, so a handful a minute is already generous.
  // Past that it is someone holding the button down, and the tally should not
  // reward it.
  rateLimit({
    windowMs: 60_000,
    limit: 10,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many requests. Slow down and try again shortly.' },
  }),
  async (req, res) => {
    if (!dbReady()) return res.json({ count: null });

    try {
      // The unique index is what decides this, not a read followed by a write:
      // two taps arriving together cannot both get past it.
      await DownloadHit.create({ key: fingerprint(req) });
    } catch {
      // Already counted today. The tally stands as it is.
      return res.json({ count: await tally() });
    }

    try {
      const doc = await Counter.findByIdAndUpdate(
        TALLY,
        { $inc: { count: 1 } },
        { new: true, upsert: true },
      ).lean();
      res.json({ count: doc?.count ?? 0 });
    } catch {
      res.json({ count: null });
    }
  },
);
