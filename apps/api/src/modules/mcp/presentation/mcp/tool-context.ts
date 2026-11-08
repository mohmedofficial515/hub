/**
 * @file What a tool handler gets: the services, who is calling, and the project they mean.
 * @description Handlers are plain functions over this context, typed by the tool table, so a missing tool is a compile
 * error. The project is resolved on first use by `ActorService.forProject`: the `project` argument, then the
 * `X-Hub-Project` header, then the member's default, and roles are read live (docs/15 §5).
 */
import {
  type CardWrittenDto,
  isPossible,
  type McpToolInput,
  type McpToolName,
  type MemberActor,
  type PermissionAction,
  type Principal,
} from '@hub/contracts';
import { Inject, Injectable } from '@nestjs/common';

import { APP_CONFIG, type AppConfig } from '@/config/config.module';
import { CLOCK, type Clock } from '@/infra/clock/clock';
import { QueueService } from '@/infra/queue/queue.service';
import { RedisClients } from '@/infra/redis/redis.module';
import { AgentQueueService } from '@/modules/agent-queue';
import { AuditQueryService } from '@/modules/audit';
import { SessionContextService, SessionsService } from '@/modules/capture';
import { CardQueryService, CardService } from '@/modules/cards';
import { ChatsService, DocDraftsService, WorkReportsService } from '@/modules/chats';
import { DevicesService } from '@/modules/devices';
import { BriefsService } from '@/modules/digests';
import { DocsReadService, DocsWriteService } from '@/modules/docs';
import { ActorService, InviteService, MeService } from '@/modules/identity';
import { InboxService } from '@/modules/notifications';
import { PlanReadService } from '@/modules/plans';
import { ReleaseNotesService } from '@/modules/releases';
import { SchemaStudioService } from '@/modules/schema-studio';
import { SearchService } from '@/modules/search';
import { SourceRunnerService } from '@/modules/system';
import { TasksReadService } from '@/modules/tasks';
import {
  MembersService,
  OnboardingService,
  ProjectsService,
  SettingsService,
  SourcesService,
} from '@/modules/workspaces';
import { AppException } from '@/shared/errors';

import { type ProjectRef, written } from './render';

@Injectable()
export class McpDeps {
  constructor(
    readonly actors: ActorService,
    readonly cards: CardService,
    readonly query: CardQueryService,
    readonly tasks: TasksReadService,
    readonly plans: PlanReadService,
    readonly releaseNotes: ReleaseNotesService,
    readonly projects: ProjectsService,
    readonly members: MembersService,
    readonly invites: InviteService,
    readonly settings: SettingsService,
    readonly sources: SourcesService,
    readonly onboarding: OnboardingService,
    readonly audit: AuditQueryService,
    readonly inbox: InboxService,
    readonly briefs: BriefsService,
    readonly docs: DocsReadService,
    readonly docsWrite: DocsWriteService,
    readonly chats: ChatsService,
    readonly workReports: WorkReportsService,
    readonly docDrafts: DocDraftsService,
    readonly agentQueue: AgentQueueService,
    readonly schema: SchemaStudioService,
    readonly search: SearchService,
    readonly runner: SourceRunnerService,
    readonly queues: QueueService,
    readonly me: MeService,
    readonly devices: DevicesService,
    readonly sessions: SessionsService,
    readonly sessionContext: SessionContextService,
    readonly redis: RedisClients,
    @Inject(CLOCK) readonly clock: Clock,
    @Inject(APP_CONFIG) readonly config: AppConfig,
  ) {}
}

export class ToolContext {
  private actorPromise: Promise<MemberActor> | undefined;
  private projectPromise: Promise<ProjectRef> | undefined;

  constructor(
    readonly deps: McpDeps,
    readonly principal: Principal,
    private readonly header: string | undefined,
    private readonly argument: string | undefined,
    /** The id Claude Code gave this tool use, which is how a call proves it came from a panel chat (`TurnRegistry`). A model cannot set it. */
    readonly toolUseId: string | undefined = undefined,
  ) {}

  actor(): Promise<MemberActor> {
    this.actorPromise ??= this.deps.actors.forProject(this.principal, {
      argument: this.argument,
      header: this.header,
    });
    return this.actorPromise;
  }

  /**
   * The actor, when their roles could ever do this. `ActorGuard` asks the same on a REST route; services that are not
   * card actions rely on it, so a tool must ask too. `CardService.apply` judges card actions itself.
   */
  async allowed(action: PermissionAction): Promise<MemberActor> {
    const actor = await this.actor();
    if (!isPossible(action, actor.roles))
      throw new AppException('hub.common.forbidden', { details: { action } });
    return actor;
  }

  project(): Promise<ProjectRef> {
    this.projectPromise ??= this.actor().then(async (actor) => {
      const project = await this.deps.projects.get(actor);
      return {
        slug: project.slug,
        name: project.name,
        locale: project.defaultLocale,
        publicUrl: this.deps.config.HUB_PUBLIC_URL,
      };
    });
    return this.projectPromise;
  }

  /** Runs one card action, the same call as the REST route, and answers what changed. */
  async apply(
    verb: string,
    key: string | null,
    action: PermissionAction,
    payload: unknown,
    extra: (card: CardWrittenDto, followUps: readonly string[]) => readonly string[] = () => [],
  ): Promise<string> {
    const actor = await this.actor();
    const result = await this.deps.cards.apply(actor, key ? { cardKey: key } : null, action, payload);
    const card = await this.deps.query.written(actor, result);
    const followUps = result.followUps
      .map((followUp) => followUp.card)
      .filter((other) => other.id !== card.id && other.type !== 'change')
      .map((other) => `${other.key} — ${other.title}`);
    return written(verb, card, await this.project(), extra(card, [...new Set(followUps)]));
  }
}

export type ToolHandler<K extends McpToolName> = (
  context: ToolContext,
  input: McpToolInput<K>,
) => Promise<string>;

export type ToolHandlers = { readonly [K in McpToolName]: ToolHandler<K> };
