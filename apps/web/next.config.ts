/**
 * @file Next.js config. H0-07 adds next-intl, the API rewrites and the rest of the shell.
 */
import type { NextConfig } from 'next';

const config: NextConfig = {
  transpilePackages: ['@hub/contracts'],
  poweredByHeader: false,
};

export default config;
