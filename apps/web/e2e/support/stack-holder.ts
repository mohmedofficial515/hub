/**
 * @file Global setup and teardown run in one process. The running stack passes between them here.
 */
import type { RunningStack } from './stack';

export const stackHolder: { stack?: RunningStack } = {};
