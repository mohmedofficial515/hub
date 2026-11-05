/**
 * @file `pnpm api:sync`: copies the API's exported OpenAPI document into the web snapshot.
 */
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const web = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
mkdirSync(join(web, 'openapi'), { recursive: true });
copyFileSync(join(web, '..', 'api', 'openapi', 'openapi.json'), join(web, 'openapi', 'openapi.json'));
console.log('apps/web/openapi/openapi.json updated.');
