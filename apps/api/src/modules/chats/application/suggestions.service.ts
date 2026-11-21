/**
 * @file Suggestions with AI (docs/16 §11, D66): `propose_suggestions` stores proposals on a panel turn, and the owner's Accept or Dismiss settles each one.
 * @description A proposal creates nothing. Accept is the owner's press in the web session, and goes through the normal create path: a task or a plan through `CardService.apply`
 * (`task.create`, `plan.create`, the same as the create tools and routes), a skill through `SkillsService.create`, which is the owner's alone. The item then records what it made,
 * so a second press, a second tab or a reload never makes it twice. Everything stored passes the secret filter.
 */
import { randomUUID } from 'node:crypto';

import {
  type AnswerSuggestionInput,
  CHAT_LIMITS,
  type ChatSuggestionDto,
  type ChatSuggestionsDto,
  chatSuggestionsSchema,
  isAllowed,
  type MemberActor,
  type ProposedSuggestion,
  type ProposeSuggestionsInput,
  redactDeep,
  type Specialty,
  SPECIALTY_DEFAULT_ROLE,
} from '@hub/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { z } from 'zod';

import { CLOCK, type Clock } from '@/infra/clock/clock';
import { type PrismaTransactionalAdapter } from '@/infra/prisma/prisma.module';
import { RealtimePublisher } from '@/infra/redis/redis.module';
import { CardService } from '@/modules/cards';
import { SkillsService } from '@/modules/skills';
import { AppException } from '@/shared/errors';

import { suggestionsToMarkdown } from '../domain/suggestions';
import { TurnRegistry } from './turn-registry';

/** A role's usual specialty, for a proposed task that names a role and no specialty. */
const SPECIALTY_OF_ROLE: Partial<Record<string, Specialty>> = Object.fromEntries(
  Object.entries(SPECIALTY_DEFAULT_ROLE).map(([specialty, role]) => [role, specialty as Specialty]),
);

@Injectable()
export class SuggestionsService {
  /** Proposals being accepted now. `CardService.apply` runs in its own transaction, so this is what stops a double press making two. */
  private readonly accepting = new Set<string>();

  constructor(
    private readonly txHost: TransactionHost<PrismaTransactionalAdapter>,
    private readonly turns: TurnRegistry,
    private readonly cards: CardService,
    private readonly skills: SkillsService,
    private readonly realtime: RealtimePublisher,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** On a panel turn, an event with the proposals; outside, the words to show. Nothing else changes. */
  async propose(
    actor: MemberActor,
    toolUseId: string | undefined,
    input: ProposeSuggestionsInput,
  ): Promise<{ inPanel: boolean; text: string }> {
    const clean = redactDeep(input) as ProposeSuggestionsInput;
    const summary = clean.summary?.trim() ? clean.summary.trim() : null;
    const text = suggestionsToMarkdown(summary, clean.items).slice(0, CHAT_LIMITS.messageChars);
    const turn = await this.turns.panelTurn(actor, toolUseId);
    if (turn) {
      await this.turns.post(turn.chatId, {
        kind: 'suggestions.proposed',
        summary,
        items: clean.items.map((proposal) => ({
          id: randomUUID(),
          state: 'open',
          ref: null,
          answeredAt: null,
          proposal,
        })),
      });
    }
    return { inPanel: turn !== null, text };
  }

  /** The owner's press on one proposal. Accept creates it through the normal path; Dismiss only records the answer. */
  async answer(
    actor: MemberActor,
    chatId: string,
    suggestionId: string,
    input: AnswerSuggestionInput,
  ): Promise<ChatSuggestionDto> {
    if (!z.uuid().safeParse(chatId).success) throw new AppException('hub.chats.not_found');
    const chat = await this.txHost.tx.chat.findFirst({
      where: { id: chatId, workspaceId: actor.workspaceId, userId: actor.userId, deletedAt: null },
      select: { id: true },
    });
    if (!chat) throw new AppException('hub.chats.not_found');
    const found = await this.find(actor, chatId, suggestionId);
    if (found.item.state !== 'open' || this.accepting.has(suggestionId)) {
      throw new AppException('hub.chats.suggestion_answered');
    }
    this.accepting.add(suggestionId);
    try {
      return await this.settle(actor, chatId, suggestionId, input, found);
    } finally {
      this.accepting.delete(suggestionId);
    }
  }

  private async settle(
    actor: MemberActor,
    chatId: string,
    suggestionId: string,
    input: AnswerSuggestionInput,
    found: { messageId: string; item: ChatSuggestionDto },
  ): Promise<ChatSuggestionDto> {
    const ref = input.decision === 'accept' ? await this.create(actor, found.item.proposal) : null;
    const answered: ChatSuggestionDto = {
      ...found.item,
      state: input.decision === 'accept' ? 'accepted' : 'dismissed',
      ref,
      answeredAt: this.clock.now().toISOString(),
    };
    await this.txHost.withTransaction(async () => {
      // Read again under the row's lock: two tabs pressing at once settle once.
      await this.txHost.tx
        .$executeRaw`SELECT 1 FROM chat_messages WHERE id = ${found.messageId}::uuid FOR UPDATE`;
      const again = await this.find(actor, chatId, suggestionId);
      if (again.item.state !== 'open') throw new AppException('hub.chats.suggestion_answered');
      const next: ChatSuggestionsDto = {
        ...again.all,
        items: again.all.items.map((item) => (item.id === suggestionId ? answered : item)),
      };
      await this.txHost.tx.chatMessage.update({
        where: { id: found.messageId, workspaceId: actor.workspaceId },
        data: { suggestions: next },
      });
    });
    await this.realtime.publishEnvelope(actor.workspaceId, {
      event: 'chat.changed',
      data: { chatId, reason: 'chat' },
      audience: { userIds: [actor.userId] },
    });
    return answered;
  }

  /** What a proposal becomes, through the same calls as the routes and tools. */
  private async create(actor: MemberActor, proposal: ProposedSuggestion): Promise<string> {
    if (proposal.kind === 'skill') {
      // A skill reaches every device: only the owner makes one, whoever proposed it.
      if (!isAllowed('skill.manage', actor.roles)) {
        throw new AppException('hub.common.forbidden', { details: { action: 'skill.manage' } });
      }
      const written = await this.skills.create(actor, {
        name: proposal.name,
        description: proposal.description,
        body: proposal.body,
        userInvocable: true,
      });
      return written.skill.name;
    }
    if (proposal.kind === 'plan') {
      const result = await this.cards.apply(actor, null, 'plan.create', {
        title: proposal.title,
        ...(proposal.body ? { body: proposal.body } : {}),
        detail: {
          steps: proposal.steps.map((step) => ({
            title: step.title,
            ...(step.role ? { role: step.role } : {}),
          })),
        },
      });
      return result.card.key;
    }
    const specialty =
      proposal.specialty ?? (proposal.ownerRole ? SPECIALTY_OF_ROLE[proposal.ownerRole] : undefined) ?? 'ops';
    const result = await this.cards.apply(actor, null, 'task.create', {
      title: proposal.title,
      ...(proposal.body ? { body: proposal.body } : {}),
      ...(proposal.priority ? { priority: proposal.priority } : {}),
      ...(proposal.ownerRole ? { ownerRole: proposal.ownerRole } : {}),
      detail: { specialty, ...(proposal.effort ? { effort: proposal.effort } : {}) },
    });
    return result.card.key;
  }

  private async find(
    actor: MemberActor,
    chatId: string,
    suggestionId: string,
  ): Promise<{ messageId: string; all: ChatSuggestionsDto; item: ChatSuggestionDto }> {
    const rows = await this.txHost.tx.chatMessage.findMany({
      where: { workspaceId: actor.workspaceId, chatId, role: 'assistant' },
      select: { id: true, suggestions: true },
    });
    for (const row of rows) {
      const parsed = chatSuggestionsSchema.safeParse(row.suggestions);
      if (!parsed.success) continue;
      const item = parsed.data.items.find((entry) => entry.id === suggestionId);
      if (item) return { messageId: row.id, all: parsed.data, item };
    }
    throw new AppException('hub.chats.suggestion_not_found');
  }
}
