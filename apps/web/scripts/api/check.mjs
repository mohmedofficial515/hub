/**
 * @file `pnpm api:check`: fails when the committed OpenAPI snapshot differs from the API's export.
 * @description Same intent as F:/Goteav/Goteav-Dashboard/scripts/api. Run `pnpm api:sync` to refresh.
 * H0-07 extends sync with client generation through hey-api.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const web = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const snapshot = join(web, 'openapi', 'openapi.json');
const exported = join(web, '..', 'api', 'openapi', 'openapi.json');

if (!existsSync(exported)) {
  console.error('apps/api/openapi/openapi.json is missing: run `pnpm --filter @hub/api openapi:export`.');
  process.exit(1);
}
if (!existsSync(snapshot) || readFileSync(snapshot, 'utf8') !== readFileSync(exported, 'utf8')) {
  console.error('apps/web/openapi/openapi.json is out of date: run `pnpm api:sync` and commit it.');
  process.exit(1);
}
console.log('OpenAPI snapshot is in sync.');
