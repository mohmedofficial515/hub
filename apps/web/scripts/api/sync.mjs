/**
 * @file `pnpm api:sync`: copies the API's exported OpenAPI document into the web snapshot and regenerates the client.
 */
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const web = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
mkdirSync(join(web, 'openapi'), { recursive: true });
copyFileSync(join(web, '..', 'api', 'openapi', 'openapi.json'), join(web, 'openapi', 'openapi.json'));
console.log('apps/web/openapi/openapi.json updated.');

const generated = spawnSync('pnpm', ['exec', 'openapi-ts'], { cwd: web, stdio: 'inherit', shell: true });
if (generated.status !== 0) process.exit(generated.status ?? 1);
console.log('apps/web/src/lib/api/generated regenerated.');
