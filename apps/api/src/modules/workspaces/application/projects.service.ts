/**
 * @file Projects (D30, docs/15 §5). A project is a workspace with extra details; routes and code say workspace.
 * @description Any signed-in member creates one and becomes its owner. Closing is reversible and a project is
 * never deleted. Settings have no rows until someone changes one, so a new project has every default at once.
 */
import {
  type CreateProjectInput,
  type MemberActor,
  type Principal,
  type Project,
  type ProjectCounts,
  type ProjectStatus,
  type Role,
  type UpdateProjectInput,
} from '@hub/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';

import { CLOCK, type Clock } from '@/infra/clock/clock';
import { type PrismaTransactionalAdapter } from '@/infra/prisma/prisma.module';
import { AuditService } from '@/modules/audit';
import { TotpPolicy } from '@/modules/identity';
import { AppException } from '@/shared/errors';
import { assertNoSecrets } from '@/shared/security/secret-filter';

import { ProjectGate } from './project-gate';

/** What a project's counts look at; deleted cards never count (D28). */
const COUNTED: readonly {
  readonly type: string;
  readonly statuses: readonly string[];
  readonly key: keyof ProjectCounts;
}[] = [
  { type: 'decision', statuses: ['open'], key: 'openDecisions' },
  { type: 'handoff', statuses: ['pending'], key: 'pendingHandoffs' },
  { type: 'need', statuses: ['requested', 'in_progress', 'delivered'], key: 'openNeeds' },
  { type: 'task', statuses: ['ready'], key: 'readyTasks' },
];

const NO_COUNTS: ProjectCounts = { openDecisions: 0, pendingHandoffs: 0, openNeeds: 0, readyTasks: 0 };

interface WorkspaceRow {
  id: string;
  slug: string;
  name: string;
  keyPrefix: string;
  timezone: string;
  defaultLocale: string;
  description: string | null;
  goals: string | null;
  links: unknown;
  repoPaths: string[];
  status: string;
  closedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

function toProject(row: WorkspaceRow): Project {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    keyPrefix: row.keyPrefix,
    timezone: row.timezone,
    defaultLocale: row.defaultLocale,
    description: row.description,
    goals: row.goals,
    links: row.links as Project['links'],
    repoPaths: row.repoPaths,
    status: row.status as ProjectStatus,
    closedAt: row.closedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function assertTimezone(timezone: string | undefined): void {
  if (timezone === undefined) return;
  try {
    new Intl.DateTimeFormat('en', { timeZone: timezone });
  } catch {
    throw new AppException('hub.common.validation', {
      details: { issues: [{ path: 'timezone', message: 'Unknown time zone' }] },
    });
  }
}

@Injectable()
export class ProjectsService {
  constructor(
    private readonly txHost: TransactionHost<PrismaTransactionalAdapter>,
    private readonly audit: AuditService,
    private readonly totp: TotpPolicy,
    private readonly gate: ProjectGate,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** The member's projects, closed ones included, with what is waiting in each. */
  async list(principal: Principal) {
    const user = await this.txHost.tx.user.findUniqueOrThrow({
      where: { id: principal.userId },
      select: { defaultWorkspaceId: true },
    });
    const memberships = await this.txHost.tx.membership.findMany({
      where: { userId: principal.userId, status: 'active' },
      include: { workspace: true },
      orderBy: { joinedAt: 'asc' },
    });
    const counts = await this.countsFor(memberships.map((membership) => membership.workspaceId));
    return Promise.all(
      memberships.map(async ({ workspace, roles }) => {
        const required = await this.totp.requiredRoles(workspace.id);
        return {
          id: workspace.id,
          slug: workspace.slug,
          name: workspace.name,
          keyPrefix: workspace.keyPrefix,
          status: workspace.status,
          roles,
          timezone: workspace.timezone,
          defaultLocale: workspace.defaultLocale,
          totpRequired: roles.some((role) => required.includes(role as Role)),
          isDefault: workspace.id === user.defaultWorkspaceId,
          counts: counts.get(workspace.id) ?? NO_COUNTS,
        };
      }),
    );
  }

  async get(actor: MemberActor) {
    const workspace = await this.txHost.tx.workspace.findUniqueOrThrow({ where: { id: actor.workspaceId } });
    const counts = await this.countsFor([actor.workspaceId]);
    return {
      ...toProject(workspace),
      myRoles: [...actor.roles],
      counts: counts.get(actor.workspaceId) ?? NO_COUNTS,
    };
  }

  async create(principal: Principal, input: CreateProjectInput): Promise<Project> {
    assertNoSecrets(input);
    assertTimezone(input.timezone);
    await this.assertFree(input.slug, input.keyPrefix);
    try {
      return await this.txHost.withTransaction(async () => {
        const workspace = await this.txHost.tx.workspace.create({
          data: {
            slug: input.slug,
            name: input.name,
            keyPrefix: input.keyPrefix,
            createdAt: this.clock.now(),
            ...(input.timezone === undefined ? {} : { timezone: input.timezone }),
            ...(input.defaultLocale === undefined ? {} : { defaultLocale: input.defaultLocale }),
            ...(input.description === undefined ? {} : { description: input.description }),
            ...(input.goals === undefined ? {} : { goals: input.goals }),
            ...(input.links === undefined ? {} : { links: input.links }),
            ...(input.repoPaths === undefined ? {} : { repoPaths: input.repoPaths }),
          },
        });
        const roles: Role[] = ['owner'];
        await this.txHost.tx.membership.create({
          data: { workspaceId: workspace.id, userId: principal.userId, roles, joinedAt: this.clock.now() },
        });
        await this.txHost.tx.user.updateMany({
          where: { id: principal.userId, defaultWorkspaceId: null },
          data: { defaultWorkspaceId: workspace.id },
        });
        if (input.docsPath) {
          await this.txHost.tx.source.create({
            data: {
              workspaceId: workspace.id,
              kind: 'local_path',
              name: 'docs',
              config: { path: input.docsPath, purpose: 'docs' },
              createdAt: this.clock.now(),
            },
          });
        }
        await this.audit.record(
          { ...principal, workspaceId: workspace.id, roles },
          {
            action: 'workspaces.create',
            targetType: 'workspace',
            targetId: workspace.id,
            summary: `Created project ${workspace.slug}`,
          },
        );
        return toProject(workspace);
      });
    } catch (error) {
      // Two creators raced past the check above: name which value was taken.
      if ((error as { code?: unknown }).code === 'P2002') await this.assertFree(input.slug, input.keyPrefix);
      throw error;
    }
  }

  async update(actor: MemberActor, input: UpdateProjectInput): Promise<Project> {
    assertNoSecrets(input);
    assertTimezone(input.timezone);
    await this.gate.assertOpen(actor.workspaceId);
    return this.txHost.withTransaction(async () => {
      const workspace = await this.txHost.tx.workspace.update({
        where: { id: actor.workspaceId },
        data: {
          ...(input.name === undefined ? {} : { name: input.name }),
          ...(input.timezone === undefined ? {} : { timezone: input.timezone }),
          ...(input.defaultLocale === undefined ? {} : { defaultLocale: input.defaultLocale }),
          ...(input.description === undefined ? {} : { description: input.description }),
          ...(input.goals === undefined ? {} : { goals: input.goals }),
          ...(input.links === undefined ? {} : { links: input.links }),
          ...(input.repoPaths === undefined ? {} : { repoPaths: input.repoPaths }),
          ...(input.status === undefined ? {} : { status: input.status }),
        },
      });
      await this.audit.record(actor, {
        action: 'workspaces.update',
        targetType: 'workspace',
        targetId: workspace.id,
        summary: `Changed ${Object.keys(input).join(', ') || 'nothing'}`,
      });
      return toProject(workspace);
    });
  }

  async close(actor: MemberActor): Promise<Project> {
    await this.gate.assertOpen(actor.workspaceId);
    return this.setClosed(actor, this.clock.now());
  }

  async reopen(actor: MemberActor): Promise<Project> {
    const workspace = await this.txHost.tx.workspace.findUniqueOrThrow({
      where: { id: actor.workspaceId },
      select: { status: true },
    });
    if (workspace.status !== 'closed') throw new AppException('hub.common.conflict');
    return this.setClosed(actor, null);
  }

  private setClosed(actor: MemberActor, closedAt: Date | null): Promise<Project> {
    return this.txHost.withTransaction(async () => {
      const workspace = await this.txHost.tx.workspace.update({
        where: { id: actor.workspaceId },
        data: { status: closedAt ? 'closed' : 'active', closedAt },
      });
      await this.audit.record(actor, {
        action: closedAt ? 'workspaces.close' : 'workspaces.reopen',
        targetType: 'workspace',
        targetId: workspace.id,
        summary: closedAt ? 'Closed the project' : 'Reopened the project',
      });
      return toProject(workspace);
    });
  }

  private async assertFree(slug: string, keyPrefix: string): Promise<void> {
    const taken = await this.txHost.tx.workspace.findFirst({
      where: { OR: [{ slug }, { keyPrefix }] },
      select: { slug: true },
    });
    if (!taken) return;
    throw new AppException(
      taken.slug === slug ? 'hub.workspaces.slug_taken' : 'hub.workspaces.key_prefix_taken',
    );
  }

  private async countsFor(workspaceIds: readonly string[]): Promise<Map<string, ProjectCounts>> {
    const rows = await this.txHost.tx.card.groupBy({
      by: ['workspaceId', 'type', 'status'],
      where: {
        workspaceId: { in: [...workspaceIds] },
        archivedAt: null,
        type: { in: COUNTED.map((counted) => counted.type) },
      },
      _count: { _all: true },
    });
    const result = new Map<string, ProjectCounts>();
    for (const row of rows) {
      const counted = COUNTED.find(
        ({ type, statuses }) => type === row.type && statuses.includes(row.status),
      );
      if (!counted) continue;
      const current = result.get(row.workspaceId) ?? NO_COUNTS;
      result.set(row.workspaceId, {
        ...current,
        [counted.key]: current[counted.key] + row._count._all,
      });
    }
    return result;
  }
}
