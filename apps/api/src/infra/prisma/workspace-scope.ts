/**
 * @file Workspace scope assertion (docs/01 §10).
 * @description In development and test, a query on a table with `workspace_id` that carries no scope
 * predicate throws, so a missing scope fails fast rather than leaking a project's data. A few tables are
 * also legitimately read per member (`userId`). Use `runUnscoped` for the rare query that must cross
 * projects (an invite looked up by its token); the reason is the code review's hook.
 */
import { AsyncLocalStorage } from 'node:async_hooks';

/** Prisma model name to the fields that count as a scope. An arch test keeps this in step with the schema. */
export const WORKSPACE_SCOPED_MODELS: Readonly<Record<string, readonly string[]>> = {
  Invite: ['workspaceId'],
  Membership: ['workspaceId', 'userId'],
  WorkspaceSetting: ['workspaceId'],
  Source: ['workspaceId'],
  GithubIdentity: ['workspaceId'],
  OnboardingProgress: ['workspaceId'],
  Card: ['workspaceId'],
  CardLink: ['workspaceId'],
  CardEvent: ['workspaceId'],
  CardComment: ['workspaceId'],
  DocChunk: ['workspaceId'],
  DocRevision: ['workspaceId'],
  Chat: ['workspaceId'],
  ChatMessage: ['workspaceId'],
  ChatStep: ['workspaceId'],
  ChatApproval: ['workspaceId'],
  ChatPromptTemplate: ['workspaceId'],
  AgentRun: ['workspaceId', 'userId'],
  DocDraft: ['workspaceId'],
  SessionLog: ['workspaceId'],
  Notification: ['workspaceId', 'userId'],
  ChannelPreference: ['workspaceId', 'userId'],
  Brief: ['workspaceId'],
  AuditLog: ['workspaceId', 'actorId'],
};

export class WorkspaceScopeError extends Error {
  constructor(model: string, operation: string) {
    super(`Query on ${model}.${operation} has no workspace scope`);
    this.name = 'WorkspaceScopeError';
  }
}

const unscoped = new AsyncLocalStorage<string>();

/** Runs `fn` with the assertion off. `reason` documents why this query crosses projects. */
export function runUnscoped<T>(reason: string, fn: () => Promise<T>): Promise<T> {
  return unscoped.run(reason, fn);
}

function hasField(where: unknown, fields: readonly string[]): boolean {
  if (typeof where !== 'object' || where === null) return false;
  for (const [key, value] of Object.entries(where)) {
    if (value === undefined) continue;
    // A compound unique such as `workspaceId_key` counts too.
    if (fields.some((field) => key === field || key.startsWith(`${field}_`))) return true;
    if (key === 'AND') {
      const parts: unknown[] = Array.isArray(value) ? value : [value];
      if (parts.some((part) => hasField(part, fields))) return true;
    }
  }
  return false;
}

function dataHasField(data: unknown, fields: readonly string[]): boolean {
  const rows: unknown[] = Array.isArray(data) ? data : [data];
  return rows.length > 0 && rows.every((row) => hasField(row, fields));
}

/** Pure, so a spec can drive every operation shape. Throws when the scope is missing. */
export function assertWorkspaceScope(model: string, operation: string, args: unknown): void {
  const fields = WORKSPACE_SCOPED_MODELS[model];
  if (!fields || unscoped.getStore() !== undefined) return;
  const shaped = (args ?? {}) as { where?: unknown; data?: unknown; create?: unknown };
  let scoped: boolean;
  switch (operation) {
    case 'create':
    case 'createMany':
    case 'createManyAndReturn':
      scoped = dataHasField(shaped.data, fields);
      break;
    case 'upsert':
      scoped = hasField(shaped.where, fields) && dataHasField(shaped.create, fields);
      break;
    default:
      scoped = hasField(shaped.where, fields);
  }
  if (!scoped) throw new WorkspaceScopeError(model, operation);
}
