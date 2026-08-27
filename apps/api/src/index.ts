import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env } from './env';
import { closeDb, connectDb, dbReady } from './db';
import { authRouter } from './routes/auth';
import { circuitsRouter } from './routes/circuits';

const app = express();

app.disable('x-powered-by');
// Correct client IPs (for rate limiting) and secure cookies behind a proxy.
if (env.trustProxy) app.set('trust proxy', 1);

app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }));

app.use(
  cors({
    origin(origin, cb) {
      // Same-origin and server-to-server calls arrive without an Origin header.
      // An unlisted origin gets no CORS headers, so the browser refuses the
      // response; the request itself is not rejected, which keeps the Next.js
      // proxy working. Cross-site POSTs are already blocked by the SameSite
      // session cookie.
      cb(null, !origin || env.origins.includes(origin));
    },
    credentials: true,
  }),
);

app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// A broad ceiling on any single client, so one caller cannot saturate the API.
app.use(
  rateLimit({
    windowMs: 60_000,
    limit: 300,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many requests. Slow down and try again shortly.' },
  }),
);

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, db: dbReady() });
});

app.use('/api/auth', authRouter);
app.use('/api', circuitsRouter);

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found.' });
});

// Never let an internal message or stack reach the client in production.
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[api]', err);
  res.status(500).json({ error: env.isProd ? 'Something went wrong.' : err.message });
});

async function main() {
  await connectDb();
  console.log('[mongo] connected');

  const server = app.listen(env.port, () => {
    console.log(`[api] listening on http://localhost:${env.port}`);
  });

  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.on(signal, () => {
      console.log(`[api] ${signal} received, shutting down`);
      server.close(() => {
        void closeDb().then(() => process.exit(0));
      });
    });
  }
}

main().catch((err: Error) => {
  console.error('[api] failed to start:', err.message);
  process.exit(1);
});
