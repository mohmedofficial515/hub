/**
 * @file Env of every e2e test context. Container URLs come from the state file `global-setup` writes.
 */
import { cpSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { readE2eState } from './e2e-state';

const state = readE2eState();
process.env['NODE_ENV'] = 'test';
process.env['TZ'] = 'UTC';
process.env['LOG_LEVEL'] = 'silent';
process.env['DATABASE_URL'] = state.databaseUrl;
process.env['REDIS_URL'] = state.redisUrl;
process.env['HUB_SECRET_KEY'] = Buffer.alloc(32, 3).toString('base64');
process.env['HUB_JWT_SECRET'] = 'e2e-signing-key-that-is-long-enough-for-hs256';
process.env['QUEUE_MODE'] = 'inline';
process.env['PROCESS_ROLE'] = 'api';
process.env['REPOS_ROOT'] = '.tmp/repos-e2e';

// Skills (docs/16 §11): a temp copy of the team pack and an empty personal folder, so no test writes to the repository or reads `~/.claude`.
// The plugin sync runs only when a test asks, so a scripted device sees no frame it did not expect.
const teamPack = mkdtempSync(join(tmpdir(), 'hub-e2e-team-pack-'));
const packSource = resolve(__dirname, '../../../../packages/team-pack');
for (const entry of ['.claude-plugin', 'plugin', 'package.json']) {
  cpSync(join(packSource, entry), join(teamPack, entry), { recursive: true });
}
process.env['HUB_TEAM_PACK_DIR'] = teamPack;
process.env['HUB_PERSONAL_SKILLS_DIR'] = join(teamPack, '.no-personal-skills');
process.env['HUB_PLUGIN_SYNC'] = 'manual';
