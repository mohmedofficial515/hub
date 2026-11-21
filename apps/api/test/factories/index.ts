/**
 * @file Object mothers for e2e tests (docs/11 §4). Add one per entity as modules need them.
 * @description They write through the direct maintenance client, past the scope assertion.
 */
import type { MemberActor, Role } from '@hub/contracts';

import type { PrismaClient } from '@/generated/prisma/client';

let counter = 0;
const next = (): number => (counter += 1);

export async function aWorkspace(
  prisma: PrismaClient,
  overrides: { status?: string; keyPrefix?: string } = {},
) {
  const n = next();
  return prisma.workspace.create({
    data: {
      slug: `project-${n}`,
      name: `Project ${n}`,
      keyPrefix:
        overrides.keyPrefix ??
        `T${String.fromCharCode(65 + (n % 26))}${String.fromCharCode(65 + (Math.floor(n / 26) % 26))}`,
      ...(overrides.status ? { status: overrides.status } : {}),
    },
  });
}

export async function aMember(
  prisma: PrismaClient,
  workspaceId: string,
  roles: readonly Role[],
  overrides: { locale?: string } = {},
) {
  const n = next();
  const user = await prisma.user.create({
    data: {
      email: `member-${n}@example.test`,
      passwordHash: 'not-a-real-hash',
      displayName: `Member ${n}`,
      avatarColor: 'teal',
      locale: overrides.locale ?? 'en',
    },
  });
  await prisma.membership.create({ data: { workspaceId, userId: user.id, roles: [...roles] } });
  return user;
}

export function userActor(userId: string, workspaceId: string, roles: readonly Role[]): MemberActor {
  return { kind: 'user', userId, via: 'web', workspaceId, roles };
}

export function agentActor(userId: string, workspaceId: string, roles: readonly Role[]): MemberActor {
  return {
    kind: 'agent',
    userId,
    via: 'mcp',
    tokenId: '00000000-0000-7000-8000-000000000001',
    workspaceId,
    roles,
  };
}
