/**
 * @file Claude's runs on a plan as every member of the project sees them (owner, 2026-11-20): read only, and only what the plan's page shows.
 * @description A run is on a plan when it is a `plan_step` or `explainer` run on the plan itself, or a `task` run on one of its steps' tasks. Each
 * comes with its step, state, times, who runs it, and the stage reports of its turn (already redacted when they were written). Nothing else of it
 * leaves here: no prompt, folder, device, chat or approval command. A member's own runs are marked, so the page keeps its controls on the queue.
 */
import type { ChatStage, MemberActor, PlanRunDto, RunSource, RunState } from '@hub/contracts';
import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';

import { type PrismaTransactionalAdapter } from '@/infra/prisma/prisma.module';
import { CardQueryService } from '@/modules/cards';
import { AppException } from '@/shared/errors';

/** How many runs a plan's page reads: the live ones and the last that ended. */
const RECENT = 30;

@Injectable()
export class PlanRunsService {
  constructor(
    private readonly txHost: TransactionHost<PrismaTransactionalAdapter>,
    private readonly query: CardQueryService,
  ) {}

  async runsOf(actor: MemberActor, key: string): Promise<PlanRunDto[]> {
    const card = await this.query.readable(actor, { cardKey: key });
    if (card.type !== 'plan') throw new AppException('hub.cards.type_mismatch');
    const steps = ((card.detail?.['steps'] ?? []) as { taskKey?: string }[]).flatMap((step) =>
      step.taskKey ? [step.taskKey] : [],
    );
    const rows = await this.txHost.tx.agentRun.findMany({
      where: {
        workspaceId: actor.workspaceId,
        OR: [
          { cardKey: card.key, source: { in: ['plan_step', 'explainer'] } },
          ...(steps.length > 0 ? [{ cardKey: { in: steps }, source: 'task' }] : []),
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: RECENT,
      select: {
        id: true,
        userId: true,
        source: true,
        cardKey: true,
        planStep: true,
        state: true,
        chatId: true,
        messageId: true,
        startedAt: true,
        endedAt: true,
        createdAt: true,
      },
    });
    const messageIds = rows.flatMap((row) => (row.messageId ? [row.messageId] : []));
    const userIds = [...new Set(rows.map((row) => row.userId))];
    const running = rows.filter((row) => row.state === 'running' && row.chatId).map((row) => row.chatId!);
    const [messages, users, pending] = await Promise.all([
      messageIds.length
        ? this.txHost.tx.chatMessage.findMany({
            where: { workspaceId: actor.workspaceId, id: { in: messageIds } },
            select: { id: true, stages: true },
          })
        : [],
      userIds.length
        ? this.txHost.tx.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, displayName: true },
          })
        : [],
      // Only whether a run waits for its owner, never on what.
      running.length
        ? this.txHost.tx.chatApproval.findMany({
            where: { workspaceId: actor.workspaceId, chatId: { in: running }, status: 'pending' },
            select: { chatId: true },
          })
        : [],
    ]);
    const waits = new Set(pending.map((row) => row.chatId));
    const stagesOf = new Map(messages.map((message) => [message.id, (message.stages ?? []) as ChatStage[]]));
    const nameOf = new Map(users.map((user) => [user.id, user.displayName]));
    return rows.map((row) => ({
      id: row.id,
      source: row.source as RunSource,
      cardKey: row.cardKey,
      planStep: row.planStep,
      state: row.state as RunState,
      waiting: row.state === 'running' && !!row.chatId && waits.has(row.chatId),
      mine: row.userId === actor.userId,
      member: { userId: row.userId, displayName: nameOf.get(row.userId) ?? '' },
      startedAt: row.startedAt?.toISOString() ?? null,
      endedAt: row.endedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      stages: (row.messageId ? (stagesOf.get(row.messageId) ?? []) : []).map((stage) => ({
        protocol: stage.protocol,
        stage: stage.stage,
        state: stage.state,
        at: stage.at,
        ...(stage.note ? { note: stage.note } : {}),
      })),
    }));
  }
}
