/**
 * @file Task reads (docs/04 §3.10): ready for my roles, mine, and the rendered prompt.
 */
import {
  type Actor,
  type CardSummary,
  type CardWithDetail,
  parseSetting,
  settingDefault,
  SPECIALTIES,
  type Specialty,
  SPECIALTY_ROLES,
} from '@hub/contracts';
import { Injectable } from '@nestjs/common';

import { CardQueryService, CardReader, CardRepository, detailText } from '@/modules/cards';
import { AppException } from '@/shared/errors';

import { renderTaskPrompt } from './task-prompt.template';

const MINE_LIMIT = 100;

@Injectable()
export class TasksReadService {
  constructor(
    private readonly query: CardQueryService,
    private readonly reader: CardReader,
    private readonly cards: CardRepository,
  ) {}

  private specialtiesOf(actor: Actor): Specialty[] {
    if (actor.roles.includes('owner') || actor.roles.includes('pm')) return [...SPECIALTIES];
    return SPECIALTIES.filter((specialty) =>
      SPECIALTY_ROLES[specialty].some((role) => actor.roles.includes(role)),
    );
  }

  /** Ready and not blocked, for one specialty or all of mine, urgent first then oldest. */
  async ready(
    actor: Actor,
    specialty: Specialty | undefined,
    limit: number | undefined,
  ): Promise<CardWithDetail[]> {
    const stored = await this.cards.readSetting(actor.workspaceId, 'tasks.ready_limit_per_role');
    const max = Number(
      stored === undefined
        ? settingDefault('tasks.ready_limit_per_role')
        : parseSetting('tasks.ready_limit_per_role', stored),
    );
    const specialties = specialty ? [specialty] : this.specialtiesOf(actor);
    const page = await this.query.listWithDetail(actor, 'task', {
      statuses: ['ready'],
      where: {
        task: { specialty: { in: specialties } },
        NOT: { linksTo: { some: { kind: 'blocks', from: { closedAt: null, archivedAt: null } } } },
      },
      sort: 'priority',
      limit: Math.min(limit ?? max, max, 100),
    });
    return [...page.items];
  }

  async mine(
    actor: Actor,
  ): Promise<{ claimed: CardSummary[]; inReview: CardSummary[]; blocked: CardSummary[] }> {
    const page = await this.query.listWithDetail(actor, 'task', {
      statuses: ['claimed', 'in_progress', 'in_review'],
      where: { assigneeId: actor.userId ?? '' },
      limit: MINE_LIMIT,
    });
    const withoutDetail = page.items.map(({ detail: _detail, ...summary }) => summary);
    return {
      claimed: withoutDetail.filter((card) => card.status !== 'in_review' && !card.flags.blocked),
      inReview: withoutDetail.filter((card) => card.status === 'in_review'),
      blocked: withoutDetail.filter((card) => card.status !== 'in_review' && card.flags.blocked),
    };
  }

  async prompt(actor: Actor, key: string): Promise<{ markdown: string }> {
    const card = await this.query.readable(actor, { cardKey: key });
    if (card.type !== 'task') throw new AppException('hub.cards.type_mismatch');
    const links = await this.reader.findLinks(actor.workspaceId, card.id);
    const decisions = links.flatMap((link) => {
      const detail = link.card.detail;
      if (link.card.type !== 'decision' || link.card.status !== 'decided' || !detail) return [];
      const options = (detail['options'] ?? []) as { id: string; title: string }[];
      return [
        {
          key: link.card.key,
          title: link.card.title,
          option: options.find((option) => option.id === detail['chosenOptionId'])?.title ?? '',
          rationale: detailText(link.card, 'rationale'),
        },
      ];
    });
    const detail = card.detail ?? {};
    const text = (name: string): string | null => {
      const value = detail[name];
      return typeof value === 'string' ? value : null;
    };
    return {
      markdown: renderTaskPrompt({
        key: card.key,
        title: card.title,
        priority: card.priority,
        specialty: text('specialty') ?? '',
        effort: text('effort'),
        repo: card.repo,
        branch: card.branch,
        body: card.body,
        prompt: text('prompt'),
        acceptance: text('acceptance'),
        decisions,
        handoffs: links
          .filter((link) => link.card.type === 'handoff')
          .map((link) => ({ key: link.card.key, summary: detailText(link.card, 'summary') })),
        docs: links
          .filter((link) => link.card.type === 'doc')
          .map((link) => ({ path: detailText(link.card, 'path', link.card.title) })),
        blockedBy: links
          .filter((link) => link.kind === 'blocked_by' && link.card.closedAt === null)
          .map((link) => ({ key: link.card.key, title: link.card.title, status: link.card.status })),
      }),
    };
  }
}
