import type { NextConfig } from 'next';

const config: NextConfig = {
  // The dashboard is a pure client of the backend API. In dev it calls the
  // API directly (CORS is enabled there); this rewrite lets a same-origin
  // deployment proxy /api to the backend without code changes.
  async rewrites() {
    const api = process.env.API_ORIGIN ?? 'http://localhost:3010';
    return [{ source: '/api/:path*', destination: `${api}/:path*` }];
  },
};

export default config;
