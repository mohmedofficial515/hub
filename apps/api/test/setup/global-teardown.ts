/**
 * @file Jest `globalTeardown`: stops the containers unless they are being reused.
 */
import { removeE2eState } from './e2e-state';

export default async function globalTeardown(): Promise<void> {
  removeE2eState();
  if (process.env['E2E_REUSE_CONTAINERS'] === 'true') return;
  const infra = globalThis.__HUB_E2E__;
  await Promise.all([infra?.postgres.stop(), infra?.redis.stop()]);
}
