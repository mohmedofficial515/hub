/**
 * @file `GET /me/context`: the block the SessionStart hook injects into a new chat (docs/05 §1, docs/15 §5, docs/16 §10).
 * @description It always names the active project, so Claude can tell the user which one the chat is on. It carries the project's brief
 * (its description and goals) and the index of its documents, with the rule to search them before writing a new one, so a chat on any
 * device starts from the knowledge on the main machine instead of rewriting it. Kept under the 10 000 characters Claude Code accepts,
 * with room for the session id line the hook adds: the brief and the index are cut first.
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
const BRIEF_CHARS = 1200;
const DOC_INDEX_SIZE = 40;

/** A Markdown text as one short paragraph, cut at a word. */
function brief(text: string | null, limit: number): string | null {
  const plain = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!plain) return null;
  if (plain.length <= limit) return plain;
  const cut = plain.slice(0, limit);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), limit - 40))}…`;
}

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
        select: { slug: true, name: true, status: true, description: true, goals: true },
      }),
      this.query.list(actor, { awaiting: 'me', limit: 10 }),
      this.query.list(actor, { type: ['task'], status: ['ready'], sort: 'priority', limit: LIST_SIZE }),
      this.sessions.withoutSummary(actor, LIST_SIZE),
      this.query.timeline(actor, { limit: LIST_SIZE }),
    ]);
    const docs = await this.docIndex(actor);
    const description = brief(workspace.description, BRIEF_CHARS);
    const goals = brief(workspace.goals, BRIEF_CHARS / 2);
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
    // The brief and the index go last, so the cut at MAX_CHARS takes them first and the lists above always arrive.
    const knowledge = [
      '',
      '## Project brief',
      description ?? 'No description yet.',
      ...(goals ? [`Goals: ${goals}`] : []),
      '',
      `## Documents (${docs.total}${docs.total > docs.rows.length ? `, the ${docs.rows.length} latest` : ''})`,
      'Hub on the main machine holds them; read them with hub.get_doc, from any device, with no copy. Before writing a new document, search them (hub.search_docs) and change the one that exists with /hub:doc; save_doc keeps the earlier text and warns about a similar one.',
      ...(docs.rows.length > 0
        ? docs.rows.map((doc) => `- ${doc.key} — ${doc.title}${doc.path ? ` · ${doc.path}` : ''}`)
        : ['None yet.']),
    ];
    lines.push(...knowledge);
    return { project: workspace.slug, text: lines.join('\n').slice(0, MAX_CHARS) };
  }

  /** The project's documents, latest change first, each with its file path. */
  private async docIndex(
    actor: MemberActor,
  ): Promise<{ total: number; rows: { key: string; title: string; path: string | null }[] }> {
    const list = await this.query.list(actor, { type: ['doc'], sort: 'lastEvent', limit: DOC_INDEX_SIZE });
    const details = await this.txHost.tx.docDetail.findMany({
      where: { cardId: { in: list.items.map((card) => card.id) } },
      select: { cardId: true, path: true },
    });
    const pathOf = new Map(details.map((detail) => [detail.cardId, detail.path]));
    return {
      total: list.pagination.total ?? list.items.length,
      rows: list.items.map((card) => ({
        key: card.key,
        title: card.title,
        path: pathOf.get(card.id) ?? null,
      })),
    };
  }
}
