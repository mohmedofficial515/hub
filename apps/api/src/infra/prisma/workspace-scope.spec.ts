/**
 * @file The assertion refuses a deliberately unscoped query (docs/12 H0-02).
 */
import { assertWorkspaceScope, runUnscoped, WorkspaceScopeError } from './workspace-scope';

describe('assertWorkspaceScope', () => {
  it('refuses an unscoped read, update and delete', () => {
    for (const operation of ['findMany', 'findFirst', 'findUnique', 'count', 'update', 'deleteMany']) {
      expect(() => assertWorkspaceScope('Card', operation, { where: { id: 'x' } })).toThrow(
        WorkspaceScopeError,
      );
    }
    expect(() => assertWorkspaceScope('Card', 'findMany', undefined)).toThrow(WorkspaceScopeError);
  });

  it('accepts the workspace in where, in AND, and in a compound unique', () => {
    expect(() => assertWorkspaceScope('Card', 'findFirst', { where: { workspaceId: 'w' } })).not.toThrow();
    expect(() =>
      assertWorkspaceScope('Card', 'findMany', { where: { AND: [{ workspaceId: 'w' }, { type: 'task' }] } }),
    ).not.toThrow();
    expect(() =>
      assertWorkspaceScope('Card', 'findUnique', {
        where: { workspaceId_key: { workspaceId: 'w', key: 'A-1' } },
      }),
    ).not.toThrow();
  });

  it('treats an undefined workspace id as no scope', () => {
    expect(() => assertWorkspaceScope('Card', 'findMany', { where: { workspaceId: undefined } })).toThrow(
      WorkspaceScopeError,
    );
  });

  it('requires the workspace on creates, per row', () => {
    expect(() => assertWorkspaceScope('Card', 'create', { data: { title: 'x' } })).toThrow(
      WorkspaceScopeError,
    );
    expect(() => assertWorkspaceScope('Card', 'create', { data: { workspaceId: 'w' } })).not.toThrow();
    expect(() =>
      assertWorkspaceScope('CardEvent', 'createMany', { data: [{ workspaceId: 'w' }, { kind: 'x' }] }),
    ).toThrow(WorkspaceScopeError);
  });

  it('accepts a member scope where the table allows it', () => {
    expect(() => assertWorkspaceScope('Membership', 'findMany', { where: { userId: 'u' } })).not.toThrow();
    expect(() => assertWorkspaceScope('Card', 'findMany', { where: { createdById: 'u' } })).toThrow(
      WorkspaceScopeError,
    );
  });

  it('ignores models without a workspace', () => {
    expect(() => assertWorkspaceScope('User', 'findMany', {})).not.toThrow();
  });

  it('runUnscoped switches it off for that call only', async () => {
    await runUnscoped('test', async () => {
      expect(() => assertWorkspaceScope('Invite', 'findUnique', { where: { tokenHash: 't' } })).not.toThrow();
    });
    expect(() => assertWorkspaceScope('Invite', 'findUnique', { where: { tokenHash: 't' } })).toThrow(
      WorkspaceScopeError,
    );
  });
});
