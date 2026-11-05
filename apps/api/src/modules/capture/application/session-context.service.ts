/**
 * @file `GET /me/context`: the block the SessionStart hook injects into a new chat (docs/05 §1, docs/15 §5).
 * @description It always names the active project, so Claude can tell the user which one the chat is on. Kept under
 * the 10 000 characters Claude Code accepts, with room for the session id line the hook adds.
 */
import type { MemberActor, Principal, TimelineRow } from '@hub/contracts';
import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';

import { type PrismaTransactionalAdapter } from '@/infra/prisma/prisma.module';
import { CardQueryService } from '@/modules/cards';
import { AppException } from '@/shared/errors';

import { SessionsService } from './sessions.service';

const MAX_CHARS = 8500;
const LIST_SIZE = 5;

function row(card: { readonly key: string; readonly title: string }, extra = ''): string {
  return `- ${card.key} — ${card.title}${extra}`;
}

@Injectable()
export class SessionContextService {
  constructor(
    private readonly txHost: TransactionHost<PrismaTransactionalAdapter>,
    private readonly query: CardQueryService,
    private readonly sessions: SessionsService,
  ) {}

  async projectOf(actor: MemberActor): Promise<string> {
    const { slug } = await this.txHost.tx.workspace.findUniqueOrThrow({
      where: { id: actor.workspaceId },
      select: { slug: true },
    });
    return slug;
  }

  async render(
    principal: Principal,
    header: string | undefined,
    cwd: string | undefined,
  ): Promise<{ project: string | null; text: string }> {
    let actor: MemberActor;
    try {
      actor = await this.sessions.actorFor(principal, header, cwd);
    } catch (error) {
      if (error instanceof AppException && error.code === 'hub.workspaces.no_project') {
        return {
          project: null,
          text: '# Hub\nYou belong to no project yet. Create one with hub.create_project.',
        };
      }
      throw error;
    }
    const [user, workspace, awaiting, ready, sessions, timeline] = await Promise.all([
      this.txHost.tx.user.findUniqueOrThrow({
        where: { id: actor.userId },
        select: { displayName: true },
      }),
      this.txHost.tx.workspace.findUniqueOrThrow({
        where: { id: actor.workspaceId },
        select: { slug: true, name: true, status: true },
      }),
      this.query.list(actor, { awaiting: 'me', limit: 10 }),
      this.query.list(actor, { type: ['task'], status: ['ready'], sort: 'priority', limit: LIST_SIZE }),
      this.sessions.withoutSummary(actor, LIST_SIZE),
      this.query.timeline(actor, { limit: LIST_SIZE }),
    ]);
    const lines = [
      `# Hub — context for ${user.displayName} (roles: ${actor.roles.join(', ')})`,
      `Active project: ${workspace.name} (slug \`${workspace.slug}\`, ${workspace.status}). Tell the user this when you first use Hub. Pass project="<slug>" on a tool to act on another.`,
      '',
      `## Awaiting you (${awaiting.pagination.total ?? awaiting.items.length})`,
      ...(awaiting.items.length > 0
        ? awaiting.items.map((card) => row(card, ` · ${card.type}: ${card.awaiting ?? ''}`))
        : ['Nothing.']),
      '',
      '## Ready tasks',
      ...(ready.items.length > 0 ? ready.items.map((card) => row(card, ` · ${card.priority}`)) : ['None.']),
      '',
      `## Your sessions without a summary (${sessions.length})`,
      ...(sessions.length > 0
        ? sessions.map(
            (session) =>
              `- ${session.cardKey} · ${session.branch ?? session.repo ?? 'no branch'} · ${session.commits} commits · session_id ${session.sessionId} → offer hub.log_session`,
          )
        : ['None.']),
      '',
      '## Latest changes',
      ...(timeline.items.length > 0
        ? timeline.items.map((item: TimelineRow) => row(item.card, ` · ${item.event.kind}`))
        : ['None yet.']),
      '',
      'Use /hub:start for the full brief, /hub:next to claim a task, /hub:plan to write a plan, /hub:done before you finish.',
    ];
    return { project: workspace.slug, text: lines.join('\n').slice(0, MAX_CHARS) };
  }
}
