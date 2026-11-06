/**
 * @file `report_work` and `propose_plan` (docs/16 §7.2, D52): what Claude says about its work, kept apart from what the server could verify.
 * @description A report on a panel chat is judged against that chat's real steps. A contradiction is refused and nothing lands on the card. Otherwise the evidence is one card event through `CardService.apply`, and the move happens in the same transaction, so a report and its move cannot come apart. `changedFiles` come from the bridge's own facts when it can answer, and otherwise are marked as Claude's words.
 */
import { randomUUID } from 'node:crypto';

import {
  capText,
  type ChangedFile,
  CHAT_LIMITS,
  type MemberActor,
  planToMarkdown,
  type ProposedPlan,
  redactDeep,
  type ReportWorkInput,
  type WorkReport,
  workReportSchema,
} from '@hub/contracts';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';

import { CLOCK, type Clock } from '@/infra/clock/clock';
import { type PrismaTransactionalAdapter } from '@/infra/prisma/prisma.module';
import { AuditService } from '@/modules/audit';
import { CardService } from '@/modules/cards';
import { BridgeHub } from '@/modules/devices';
import { AppException } from '@/shared/errors';

import { countsOf, droppedFrom, judgeChecks, moveEligibility } from '../domain/work-report';
import { type PanelTurn, TurnRegistry } from './turn-registry';

const FILES_TIMEOUT_MS = 20_000;
const REPORTS_LIMIT = 20;

@Injectable()
export class WorkReportsService {
  private readonly logger = new Logger(WorkReportsService.name);

  constructor(
    private readonly txHost: TransactionHost<PrismaTransactionalAdapter>,
    private readonly cards: CardService,
    private readonly hub: BridgeHub,
    private readonly audit: AuditService,
    private readonly turns: TurnRegistry,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async report(
    actor: MemberActor,
    toolUseId: string | undefined,
    input: ReportWorkInput,
  ): Promise<WorkReport> {
    const turn = await this.turns.panelTurn(actor, toolUseId);
    const steps = turn ? await this.stepsOf(actor, turn) : null;
    const { checks, contradictions } = judgeChecks(input.checks, steps);
    if (turn && contradictions.length > 0) {
      await this.turns.post(turn.chatId, {
        kind: 'report.refused',
        cardKey: input.card,
        checks: contradictions,
      });
      await this.audit.record(actor, {
        action: 'chats.report.refused',
        targetType: 'chat',
        targetId: turn.chatId,
        summary:
          `A report on ${input.card} said a failed step passed: ${contradictions.map((item) => item.name).join(', ')}`.slice(
            0,
            1_000,
          ),
      });
      throw new AppException('hub.chats.report_contradicted', { details: { checks: contradictions } });
    }
    const dropped = turn ? droppedFrom(await this.earlierReports(actor, turn), input.card, checks) : [];
    const origin = turn ? 'panel' : 'outside_panel';
    const files = await this.filesFor(turn, input);
    const draft = workReportSchema.parse(
      redactDeep({
        id: randomUUID(),
        cardKey: input.card,
        origin,
        chatId: turn?.chatId ?? null,
        messageId: turn?.messageId ?? null,
        summary: input.summary,
        checks,
        changedFiles: files.list,
        filesFrom: files.from,
        notChecked: input.notChecked,
        droppedChecks: dropped,
        counts: countsOf(checks),
        move: { moved: false, reason: moveEligibility(origin, checks, dropped), from: null, to: null },
        reportedAt: this.clock.now().toISOString(),
      }),
    );
    const applied = await this.cards.apply(actor, { cardKey: input.card }, 'card.report_work', draft);
    const report = workReportSchema.parse(applied.event.data);
    if (turn) await this.turns.post(turn.chatId, { kind: 'work.reported', report });
    return report;
  }

  /** What Claude has reported on a card, newest first: the evidence the sheet shows. */
  async reportsOn(actor: MemberActor, key: string): Promise<WorkReport[]> {
    const rows = await this.txHost.tx.cardEvent.findMany({
      where: {
        workspaceId: actor.workspaceId,
        kind: 'work_reported',
        card: { key, workspaceId: actor.workspaceId },
      },
      orderBy: { seq: 'desc' },
      take: REPORTS_LIMIT,
      select: { data: true },
    });
    return rows.flatMap((row) => {
      const parsed = workReportSchema.safeParse(row.data);
      return parsed.success ? [parsed.data] : [];
    });
  }

  /** `propose_plan`: on a panel turn, an event with the structure; outside, the words to show. Nothing else changes. */
  async proposePlan(
    actor: MemberActor,
    toolUseId: string | undefined,
    plan: ProposedPlan,
  ): Promise<{ inPanel: boolean; text: string }> {
    const clean = redactDeep(plan) as ProposedPlan;
    const text = capText(planToMarkdown(clean), CHAT_LIMITS.messageChars).text;
    const turn = await this.turns.panelTurn(actor, toolUseId);
    if (turn) {
      await this.turns.post(turn.chatId, { kind: 'plan.proposed', plan: text, structured: clean });
    }
    return { inPanel: turn !== null, text };
  }

  private async stepsOf(actor: MemberActor, turn: PanelTurn) {
    return this.txHost.tx.chatStep.findMany({
      where: { workspaceId: actor.workspaceId, chatId: turn.chatId, command: { not: null } },
      orderBy: { startedAt: 'asc' },
      select: {
        toolUseId: true,
        command: true,
        status: true,
        output: true,
        startedAt: true,
        endedAt: true,
      },
    });
  }

  private async earlierReports(actor: MemberActor, turn: PanelTurn): Promise<WorkReport[]> {
    const rows = await this.txHost.tx.chatMessage.findMany({
      where: { workspaceId: actor.workspaceId, chatId: turn.chatId, role: 'assistant' },
      select: { reports: true },
    });
    return rows.flatMap((row) => row.reports as unknown as WorkReport[]);
  }

  /** The device's facts when it can answer. A device that cannot leaves Claude's words, marked as such. */
  private async filesFor(
    turn: PanelTurn | null,
    input: ReportWorkInput,
  ): Promise<{ list: ChangedFile[]; from: WorkReport['filesFrom'] }> {
    if (turn) {
      try {
        const answer = await this.hub.request<{ available: boolean; files: ChangedFile[] }>(
          turn.deviceId,
          'turn.files',
          { chatId: turn.chatId },
          { timeoutMs: FILES_TIMEOUT_MS },
        );
        if (answer.available) {
          return { list: answer.files.slice(0, CHAT_LIMITS.changedFiles), from: 'bridge' };
        }
      } catch (error) {
        this.logger.warn(`The device gave no facts for a report: ${String(error)}`);
      }
    }
    const claimed = input.changedFiles ?? [];
    return claimed.length === 0
      ? { list: [], from: 'none' }
      : { list: claimed.map((path) => ({ path, source: 'claimed' as const })), from: 'claimed' };
  }
}
