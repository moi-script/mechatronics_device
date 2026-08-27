import type { NextConfig } from 'next';

const config: NextConfig = {
  transpilePackages: ['@mech/sim'],
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/api/:path*`,
      },
    ];
  },
};

export default config;
