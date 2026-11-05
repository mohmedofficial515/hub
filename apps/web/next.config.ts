/**
 * @file Next.js config: next-intl, and the API behind the web origin, so its cookies are first-party and SSE is same-origin.
 */
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const API_ORIGIN = process.env.HUB_API_ORIGIN ?? 'http://localhost:7310';

const config: NextConfig = {
  // "Open in the lab" (docs/15 §3). Fixed at `next build`, as the rewrites are.
  env: {
    NEXT_PUBLIC_LAB_URL: process.env.NEXT_PUBLIC_LAB_URL ?? process.env.LAB_URL ?? 'http://localhost:6200',
  },
  transpilePackages: ['@hub/contracts'],
  poweredByHeader: false,
  // Compressing through the proxy would hold SSE frames back until a buffer fills, and the live stream would look dead.
  compress: false,
  async rewrites() {
    return [{ source: '/api/v1/:path*', destination: `${API_ORIGIN}/api/v1/:path*` }];
  },
};

export default withNextIntl(config);
