import path from 'node:path';
import type { NextConfig } from 'next';

/**
 * The Android app is this same site exported as static files (see apps/mobile,
 * whose build script sets the server-only /api and /view routes aside first).
 */
const offline = process.env.NEXT_PUBLIC_OFFLINE === '1';

const config: NextConfig = offline
  ? {
      output: 'export',
      transpilePackages: ['@mech/sim'],
      images: { unoptimized: true },
    }
  : {
      // A self-contained server bundle for the container image. Vercel builds Next
      // its own way, so standalone is skipped there.
      output: process.env.VERCEL ? undefined : 'standalone',
      outputFileTracingRoot: path.join(__dirname, '../..'),
      transpilePackages: ['@mech/sim'],
      poweredByHeader: false,
      async headers() {
        return [
          {
            // The installed app reads this to see whether it is out of date,
            // and it asks from its own origin inside the webview.
            source: '/apk-version.json',
            headers: [
              { key: 'Access-Control-Allow-Origin', value: '*' },
              { key: 'Cache-Control', value: 'no-store' },
            ],
          },
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
