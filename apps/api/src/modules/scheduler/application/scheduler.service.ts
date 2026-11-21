/**
 * @file The deadline engine (docs/07 §5): reminders, overdue, escalation, stale handoffs and needs, orphaned claims.
 * @description Idempotent by construction: each rule asks what is already recorded on the card, so running a tick
 * twice changes nothing. Every change goes through `CardService.apply` as the system. A stale reminder's cadence comes
 * from the card's last `reminder_sent` event, which every type has, rather than a field per detail table. One card
 * that fails is logged and does not stop the others.
 */
import type { PermissionAction, SystemActor } from '@hub/contracts';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';

import { CLOCK, type Clock } from '@/infra/clock/clock';
import { type PrismaTransactionalAdapter } from '@/infra/prisma/prisma.module';
import { CardService } from '@/modules/cards';
import { SettingsService } from '@/modules/workspaces';

import { reminderDue } from '../domain/reminders';

const HOUR = 3_600_000;
const STALE_HANDOFF_EVERY_HOURS = 24;
const STALE_NEED_EVERY_HOURS = 48;
const ORPHANED_CLAIM_DAYS = 14;

export interface TickResult {
  reminders: number;
  escalations: number;
  staleHandoffs: number;
  staleNeeds: number;
  orphanedClaims: number;
}

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly txHost: TransactionHost<PrismaTransactionalAdapter>,
    private readonly cards: CardService,
    private readonly settings: SettingsService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** Every project that is not closed: a closed one refuses changes (D30). */
  async tickAll(): Promise<void> {
    const workspaces = await this.txHost.tx.workspace.findMany({
      where: { status: { not: 'closed' } },
      select: { id: true },
    });
    for (const workspace of workspaces) await this.tick(workspace.id);
  }

  async tick(workspaceId: string): Promise<TickResult> {
    const actor: SystemActor = { kind: 'system', userId: null, via: 'scheduler', workspaceId, roles: [] };
    return {
      reminders: await this.remindDecisions(actor),
      escalations: await this.escalateDecisions(actor),
      staleHandoffs: await this.remindStale(
        actor,
        'handoff',
        ['pending'],
        await this.staleHandoffBefore(actor),
      ),
      staleNeeds: await this.remindStale(
        actor,
        'need',
        ['requested', 'in_progress'],
        await this.staleNeedBefore(actor),
      ),
      orphanedClaims: await this.nudgeOrphanedClaims(actor),
    };
  }

  private async attempt(
    actor: SystemActor,
    cardId: string,
    action: PermissionAction,
    payload: unknown,
  ): Promise<boolean> {
    try {
      await this.cards.apply(actor, { cardId }, action, payload);
      return true;
    } catch (error) {
      this.logger.warn(`${action} on ${cardId} failed: ${String(error)}`);
      return false;
    }
  }

  private async remindDecisions(actor: SystemActor): Promise<number> {
    const now = this.clock.now();
    const offsets = await this.settings.value(actor.workspaceId, 'decisions.reminder_offsets_hours');
    const widest = Math.max(0, ...offsets);
    const rows = await this.txHost.tx.card.findMany({
      where: {
        workspaceId: actor.workspaceId,
        type: 'decision',
        status: 'open',
        archivedAt: null,
        dueAt: { not: null, lte: new Date(now.getTime() + widest * HOUR) },
      },
      select: { id: true, dueAt: true, decision: { select: { remindersSent: true } } },
    });
    let done = 0;
    for (const row of rows) {
      if (!row.dueAt) continue;
      const sent = (row.decision?.remindersSent ?? []) as number[];
      const due = reminderDue(row.dueAt, now, offsets, sent);
      if (!due) continue;
      const payload = {
        reason: due.offsetHours === null ? 'overdue' : 'before_due',
        ...(due.offsetHours === null ? {} : { offsetHours: due.offsetHours }),
        remindersSent: due.sent,
      };
      if (await this.attempt(actor, row.id, 'card.remind', payload)) done += 1;
    }
    return done;
  }

  private async escalateDecisions(actor: SystemActor): Promise<number> {
    const hours = await this.settings.value(actor.workspaceId, 'decisions.escalation_hours');
    const rows = await this.txHost.tx.card.findMany({
      where: {
        workspaceId: actor.workspaceId,
        type: 'decision',
        status: 'open',
        archivedAt: null,
        dueAt: { lte: new Date(this.clock.now().getTime() - hours * HOUR) },
        decision: { escalatedAt: null },
      },
      select: { id: true },
    });
    let done = 0;
    for (const row of rows) {
      if (await this.attempt(actor, row.id, 'decision.escalate', { afterHours: hours })) done += 1;
    }
    return done;
  }

  private async staleHandoffBefore(actor: SystemActor): Promise<{ before: Date; everyHours: number }> {
    const hours = await this.settings.value(actor.workspaceId, 'handoffs.stale_hours');
    return {
      before: new Date(this.clock.now().getTime() - hours * HOUR),
      everyHours: STALE_HANDOFF_EVERY_HOURS,
    };
  }

  private async staleNeedBefore(actor: SystemActor): Promise<{ before: Date; everyHours: number }> {
    const days = await this.settings.value(actor.workspaceId, 'needs.stale_days');
    return {
      before: new Date(this.clock.now().getTime() - days * 24 * HOUR),
      everyHours: STALE_NEED_EVERY_HOURS,
    };
  }

  private async remindStale(
    actor: SystemActor,
    type: 'handoff' | 'need',
    statuses: readonly string[],
    rule: { before: Date; everyHours: number },
  ): Promise<number> {
    const quietSince = new Date(this.clock.now().getTime() - rule.everyHours * HOUR);
    const rows = await this.txHost.tx.card.findMany({
      where: {
        workspaceId: actor.workspaceId,
        type,
        status: { in: [...statuses] },
        archivedAt: null,
        createdAt: { lte: rule.before },
        NOT: { events: { some: { kind: 'reminder_sent', createdAt: { gt: quietSince } } } },
      },
      select: { id: true },
    });
    let done = 0;
    for (const row of rows) {
      if (await this.attempt(actor, row.id, 'card.remind', { reason: 'stale' })) done += 1;
    }
    return done;
  }

  /** A nudge is itself an event, so "14 days without any event" also makes it once per 14 days. */
  private async nudgeOrphanedClaims(actor: SystemActor): Promise<number> {
    const rows = await this.txHost.tx.card.findMany({
      where: {
        workspaceId: actor.workspaceId,
        type: 'task',
        status: 'claimed',
        archivedAt: null,
        lastEventAt: { lte: new Date(this.clock.now().getTime() - ORPHANED_CLAIM_DAYS * 24 * HOUR) },
      },
      select: { id: true },
    });
    let done = 0;
    for (const row of rows) {
      if (await this.attempt(actor, row.id, 'card.remind', { reason: 'orphaned_claim' })) done += 1;
    }
    return done;
  }
}
