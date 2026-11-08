/**
 * @file A hello Hub cannot answer (the database is down) sends the bridge away to try again, instead of leaving a socket that is open and never ready.
 */
import { BRIDGE_CLOSE, BRIDGE_PROTOCOL_VERSION } from '@hub/contracts';
import type { TransactionHost } from '@nestjs-cls/transactional';

import type { PrismaTransactionalAdapter } from '@/infra/prisma/prisma.module';

import { BridgeHub } from './bridge-hub';

const hello = JSON.stringify({ type: 'hello', protocol: BRIDGE_PROTOCOL_VERSION, status: {}, actions: [] });

function aHub(updateMany: jest.Mock): BridgeHub {
  const tx = {
    device: { updateMany },
    deviceFolder: { findMany: jest.fn().mockResolvedValue([]) },
    folder: { findMany: jest.fn().mockResolvedValue([]) },
    membership: { findMany: jest.fn().mockResolvedValue([]) },
    source: { findMany: jest.fn().mockResolvedValue([]) },
    project: { findMany: jest.fn().mockResolvedValue([]) },
  };
  return new BridgeHub({ tx } as unknown as TransactionHost<PrismaTransactionalAdapter>);
}

describe('BridgeHub hello', () => {
  it('closes with the retry code when the hello cannot be stored, and the device stays offline', async () => {
    const hub = aHub(jest.fn().mockRejectedValue(new Error("Can't reach database server")));
    const socket = { send: jest.fn(), close: jest.fn() };
    hub.attach('d1', 'u1', socket);
    await hub.receive('d1', hello);
    expect(socket.close).toHaveBeenCalledWith(BRIDGE_CLOSE.unavailable, 'try again');
    expect(socket.close).not.toHaveBeenCalledWith(BRIDGE_CLOSE.revoked, expect.anything());
    expect(hub.isOnline('d1')).toBe(false);
  });
});
