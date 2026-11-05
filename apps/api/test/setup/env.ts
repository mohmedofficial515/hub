/**
 * @file Env of every e2e test context. Container URLs come from the state file `global-setup` writes.
 */
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
