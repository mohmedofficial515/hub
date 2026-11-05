/**
 * @file Turns a Principal into an Actor: chooses the project and reads live roles (docs/15 §5).
 * @description A project the member does not belong to answers not found, so its existence never leaks.
 * The MCP module calls `forProject` with the tool's `project` argument and the `X-Hub-Project` header.
 */
import { type MemberActor, type Principal, type Role, ROLES } from '@hub/contracts';
import { Injectable } from '@nestjs/common';

import { AppException } from '@/shared/errors';

import { type MembershipLookup, MembershipRepository } from './ports/membership.repository';

export interface ProjectChoice {
  /** The tool's optional `project` argument (slug). Wins over everything. */
  readonly argument?: string | undefined;
  /** The `X-Hub-Project` header, which `hub link` writes for a connected folder. */
  readonly header?: string | undefined;
}

@Injectable()
export class ActorService {
  constructor(private readonly memberships: MembershipRepository) {}

  /** For routes under `/workspaces/:ws`. */
  async forSlug(principal: Principal, slug: string): Promise<MemberActor> {
    const membership = await this.memberships.findBySlug(principal.userId, slug);
    if (!membership) throw new AppException('hub.workspaces.not_found');
    return this.toActor(principal, membership);
  }

  /** Argument, then header, then the member's default project (docs/15 §5). */
  async forProject(principal: Principal, choice: ProjectChoice = {}): Promise<MemberActor> {
    const slug = choice.argument ?? choice.header;
    if (slug) return this.forSlug(principal, slug);
    const membership = await this.memberships.findDefault(principal.userId);
    if (!membership) throw new AppException('hub.workspaces.no_project');
    return this.toActor(principal, membership);
  }

  private toActor(principal: Principal, membership: MembershipLookup): MemberActor {
    const roles = membership.roles.filter((role): role is Role =>
      (ROLES as readonly string[]).includes(role),
    );
    return { ...principal, workspaceId: membership.workspaceId, roles };
  }
}
