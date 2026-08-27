import 'dotenv/config';

const isProd = process.env.NODE_ENV === 'production';

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value) return value;
  // The advice differs by environment: locally it is a missing file, on a host
  // it is a missing setting, and a deploy log should say the latter.
  throw new Error(
    isProd
      ? `${name} is required. Set it in your host's environment settings, then redeploy.`
      : `${name} is required. Copy .env.example to .env and fill it in.`,
  );
}

const JWT_SECRET = required('JWT_SECRET', isProd ? undefined : 'dev-secret-change-me');

// A shipped default secret would let anyone mint a session cookie.
if (isProd && (JWT_SECRET === 'dev-secret-change-me' || JWT_SECRET.length < 32)) {
  throw new Error('JWT_SECRET must be a unique value of at least 32 characters in production.');
}

/** Origins allowed to call the API with credentials, comma separated. */
const origins = (process.env.WEB_ORIGIN ?? 'http://localhost:3000')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

export const env = {
  isProd,
  port: Number(process.env.PORT ?? 4000),
  mongoUri: required('MONGODB_URI', isProd ? undefined : 'mongodb://127.0.0.1:27017/mechatronic_trainer'),
  jwtSecret: JWT_SECRET,
  origins,
  /** Set when the API sits behind a reverse proxy or load balancer. */
  trustProxy: process.env.TRUST_PROXY === 'true',
  /** Needed when the browser calls the API cross-site rather than through a proxy. */
  crossSiteCookies: process.env.CROSS_SITE_COOKIES === 'true',
} as const;
