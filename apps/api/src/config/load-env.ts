/**
 * @file Loads the monorepo root `.env` for local development.
 * @description Adapted from F:/Goteav/backend/src/config/load-env.ts. Production and tests never read
 * files, and real environment variables always win. Located from cwd or the file, for src and dist alike.
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { config as loadDotenvFile } from 'dotenv';

export function loadEnv(nodeEnv: string | undefined = process.env['NODE_ENV']): void {
  if (nodeEnv === 'production' || nodeEnv === 'test') return;
  for (const path of [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../../.env')]) {
    if (existsSync(path)) {
      loadDotenvFile({ path, override: false, quiet: true });
      return;
    }
  }
}
