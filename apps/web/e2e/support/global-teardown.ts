/**
 * @file Stops what `global-setup.ts` started. Testcontainers' reaper removes the containers if this never runs.
 */
import { stopStack } from './stack';
import { stackHolder } from './stack-holder';

export default async function globalTeardown() {
  if (stackHolder.stack) await stopStack(stackHolder.stack);
}
