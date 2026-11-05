/**
 * @file The bridge restates the socket's names, so this holds them to `@hub/contracts`.
 */
import {
  BRIDGE_ACTIONS,
  BRIDGE_CLOSE,
  BRIDGE_PROTOCOL_VERSION,
  BRIDGE_REFUSALS,
  BRIDGE_SOCKET_PATH,
  HEALTH_CHECK_IDS,
  HEALTH_FIXES,
} from '@hub/contracts';
import { describe, expect, it } from 'vitest';

import * as protocol from '../lib/protocol.mjs';

describe('the protocol matches the contract', () => {
  it('names the same things', () => {
    expect(protocol.BRIDGE_ACTIONS).toEqual([...BRIDGE_ACTIONS]);
    expect(protocol.BRIDGE_REFUSALS).toEqual([...BRIDGE_REFUSALS]);
    expect(protocol.HEALTH_FIXES).toEqual([...HEALTH_FIXES]);
    expect(protocol.HEALTH_CHECK_IDS).toEqual([...HEALTH_CHECK_IDS]);
    expect(protocol.BRIDGE_CLOSE).toEqual(BRIDGE_CLOSE);
    expect(protocol.BRIDGE_PROTOCOL_VERSION).toBe(BRIDGE_PROTOCOL_VERSION);
    expect(protocol.BRIDGE_SOCKET_PATH).toBe(BRIDGE_SOCKET_PATH);
  });
});
