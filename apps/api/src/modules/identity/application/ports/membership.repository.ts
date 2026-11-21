/**
 * @file Port for the membership reads that turn a Principal into an Actor.
 */
export interface MembershipLookup {
  readonly workspaceId: string;
  readonly roles: readonly string[];
}

export abstract class MembershipRepository {
  /** The active membership in the project with this slug, or null. */
  abstract findBySlug(userId: string, slug: string): Promise<MembershipLookup | null>;
  /** The active membership in the member's default project, or null. */
  abstract findDefault(userId: string): Promise<MembershipLookup | null>;
}
