import path from 'node:path';
import type { NextConfig } from 'next';

/**
 * The Android app is this same site exported as static files (see apps/mobile).
 * With no server behind it, the /api proxy and the share viewer cannot exist,
 * so those files carry a .web suffix that only the server build picks up.
 */
const offline = process.env.NEXT_PUBLIC_OFFLINE === '1';

const config: NextConfig = offline
  ? {
      output: 'export',
      pageExtensions: ['tsx', 'ts'],
      transpilePackages: ['@mech/sim'],
      images: { unoptimized: true },
    }
  : {
      // A self-contained server bundle for the container image. Vercel builds Next
      // its own way, so standalone is skipped there.
      output: process.env.VERCEL ? undefined : 'standalone',
      pageExtensions: ['web.tsx', 'web.ts', 'tsx', 'ts'],
      outputFileTracingRoot: path.join(__dirname, '../..'),
      transpilePackages: ['@mech/sim'],
      poweredByHeader: false,
      async headers() {
        return [
          {
            source: '/:path*',
            headers: [
              { key: 'X-Content-Type-Options', value: 'nosniff' },
              { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
              { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
              { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
            ],
          },
        ];
      },
    };

export default config;
