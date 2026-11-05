/**
 * @file Principal and Actor: who is calling, and who they are inside one project.
 * @description A token or session authenticates a Principal, which belongs to no project (docs/15 §5).
 * Picking a project and reading the member's live roles turns it into an Actor, which every mutation takes.
 * The kind and `via` are recorded, never used to refuse (D27).
 */
import type { Role } from './roles';

export const ACTOR_KINDS = ['user', 'agent', 'hook', 'system'] as const;
export type ActorKind = (typeof ACTOR_KINDS)[number];

export const VIAS = ['web', 'mcp', 'hook', 'adapter', 'import', 'scheduler', 'telegram'] as const;
export type Via = (typeof VIAS)[number];

/** An authenticated member, before a project is chosen. */
export type Principal =
  | { readonly kind: 'user'; readonly userId: string; readonly via: 'web' }
  | {
      readonly kind: 'agent';
      readonly userId: string;
      readonly via: 'mcp';
      readonly tokenId: string;
      /** Set for a paired device's credential, which reaches only MCP and the bridge channel (docs/16 §5). */
      readonly deviceId?: string;
    }
  | { readonly kind: 'hook'; readonly userId: string; readonly via: 'hook'; readonly tokenId: string };

/** A member acting inside one project. `roles` are live, from Membership. */
export type MemberActor = Principal & {
  readonly workspaceId: string;
  readonly roles: readonly Role[];
};

/** Adapters, importers and schedulers. Bypasses the role matrix; has no member behind it. */
export interface SystemActor {
  readonly kind: 'system';
  readonly userId: null;
  readonly via: 'adapter' | 'import' | 'scheduler';
  readonly workspaceId: string;
  readonly roles: readonly Role[];
}

export type Actor = MemberActor | SystemActor;

/** How the actor is stored on `cards.created_by_kind` and `card_events.actor_kind` (docs/03 §5). */
export function storedActorKind(actor: { readonly kind: ActorKind }): 'user' | 'agent' | 'system' {
  if (actor.kind === 'hook') return 'agent';
  return actor.kind;
}
