/**
 * @file Next.js config: next-intl, the API behind the web origin, so its cookies are first-party and SSE is same-origin, and the lab at `/lab` (docs/16 §6).
 */
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const API_ORIGIN = process.env.HUB_API_ORIGIN ?? 'http://localhost:7310';
// Fixed at `next build`, as the API's is. `middleware.ts` guards what passes through.
const LAB_ORIGIN = process.env.HUB_LAB_ORIGIN ?? 'http://127.0.0.1:7320';

const config: NextConfig = {
  // Lets a second dev server run beside another without sharing a build folder.
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  transpilePackages: ['@hub/contracts'],
  poweredByHeader: false,
  // Compressing through the proxy would hold SSE frames back until a buffer fills, and the live stream would look dead.
  compress: false,
  async rewrites() {
    return [
      { source: '/api/v1/:path*', destination: `${API_ORIGIN}/api/v1/:path*` },
      { source: '/lab', destination: `${LAB_ORIGIN}/lab/` },
      { source: '/lab/:path*', destination: `${LAB_ORIGIN}/lab/:path*` },
    ];
  },
};

export default withNextIntl(config);
