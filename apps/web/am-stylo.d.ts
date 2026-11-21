/**
 * @file Types for `am-stylo/next`, the local design tool `next.config.ts` wraps the config with. The package ships plain CommonJS with no types; this
 * says what the config uses, so `next build` type-checks. The plugin changes nothing in a production build.
 */
declare module 'am-stylo/next' {
  import type { NextConfig } from 'next';

  const withPageCompanion: (config: NextConfig, options?: Record<string, unknown>) => NextConfig;
  export default withPageCompanion;
}
