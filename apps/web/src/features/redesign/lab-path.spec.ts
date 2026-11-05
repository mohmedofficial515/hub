/**
 * @file What may pass through Hub's proxy to the lab.
 */
import { describe, expect, it } from 'vitest';

import { labPathAllowed } from './lab-path';

describe('labPathAllowed', () => {
  it.each([
    '/lab',
    '/lab/',
    '/lab/frame-web.html',
    '/lab/@vite/client',
    '/lab/@fs/F:/Goteav/hub/apps/lab/web/wallet/v2/page.tsx',
    '/lab/@fs/F:/Goteav/hub/node_modules/.pnpm/react@19/node_modules/react/index.js',
    '/lab/node_modules/.vite/deps/react.js',
    '/lab/src/frame/hub.tsx',
  ])('lets the lab through: %s', (path) => {
    expect(labPathAllowed(path)).toBe(true);
  });

  it.each([
    '/lab/../.env',
    '/lab/./x',
    '/lab/..%2f..%2f.env',
    '/lab/%2e%2e/%2e%2e/.env',
    '/lab/%252e%252e/.env',
    '/lab/%25252e%25252e/.env',
    '/lab/..%5c..%5c.env',
    '/lab/a\\b',
    '/lab/.env',
    '/lab/@fs/F:/Goteav/hub/.env',
    '/lab/.git/config',
    '/lab/x%00.png',
    '/lab/%E0%A4%A',
    '/lab/%2525252525252e',
  ])('refuses: %s', (path) => {
    expect(labPathAllowed(path)).toBe(false);
  });
});
