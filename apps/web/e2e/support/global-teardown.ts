/**
 * @file Stops what `global-setup.ts` started. Testcontainers' reaper removes the containers if this never runs.
 */
import { stopLeftoverBridges } from './scripted-engine';
import { stopStack } from './stack';
import { stackHolder } from './stack-holder';

export default async function globalTeardown() {
  stopLeftoverBridges();
  if (stackHolder.stack) await stopStack(stackHolder.stack);
}
