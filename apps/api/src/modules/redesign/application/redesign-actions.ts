/**
 * @file Redesign actions (docs/04 §3.14). Each writes the lab's front-matter first, inside the transaction (docs/15 §3).
 * @description The file is the truth: if it cannot be written the action fails and the card does not move. If the commit
 * fails after the write, the next scan reconciles from the file (docs/06 §5.6). A card with no lab behind it just moves.
 * Approving creates the port task, whose Claim the redesign's row then offers. Marking ported closes it.
 */
import {
  type ApproveRedesignInput,
  approveRedesignSchema,
  type CreateRedesignInput,
  createRedesignSchema,
  type MarkPortedInput,
  markPortedSchema,
  parseSetting,
  type RedesignNoteInput,
  redesignNoteSchema,
  settingDefault,
  SPECIALTIES,
  type Specialty,
} from '@hub/contracts';
import { Injectable } from '@nestjs/common';
import { z } from 'zod';

import {
  type CardActionContext,
  type CardActionDefinition,
  CardActionHandler,
  type CardActionPlan,
  CardRepository,
  type CardView,
  defined,
  detailText,
} from '@/modules/cards';
import { AppException } from '@/shared/errors';

import { appendReviewNote, setFrontMatter } from '../domain/front-matter';
import { LabFilesService } from './lab-files.service';
import { renderPortTask } from './port-task.template';

/** Writes the version's README and records its new hash, so the next scan sees nothing new. */
@Injectable()
export class LabWriteBack {
  constructor(
    private readonly files: LabFilesService,
    private readonly cards: CardRepository,
  ) {}

  private async decidedFields(
    actorId: string | null,
    workspaceNow: Date,
    note: string | undefined,
  ): Promise<Record<string, string>> {
    const names = await this.cards.findUserNames(actorId ? [actorId] : []);
    return {
      'decided-at': workspaceNow.toISOString(),
      'decided-by': (actorId ? names.get(actorId) : undefined) ?? 'Hub',
      ...(note ? { 'decision-note': note } : {}),
    };
  }

  private async write(card: CardView, edit: (raw: string) => string): Promise<void> {
    const labPath = detailText(card, 'labPath');
    if (!labPath) return;
    const written = await this.files.editReadme(card.workspaceId, labPath, edit);
    if (written) await this.cards.updateDetail(card, { readmeHash: written.readmeHash });
  }

  setStatus(card: CardView, status: string, extra: Readonly<Record<string, string>> = {}): Promise<void> {
    return this.write(card, (raw) => setFrontMatter(raw, { status, ...extra }));
  }

  async decide(
    card: CardView,
    status: string,
    actorId: string | null,
    now: Date,
    note?: string,
  ): Promise<void> {
    await this.setStatus(card, status, await this.decidedFields(actorId, now, note));
  }

  async reviewNote(card: CardView, actorId: string | null, now: Date, note: string): Promise<void> {
    const names = await this.cards.findUserNames(actorId ? [actorId] : []);
    const who = (actorId ? names.get(actorId) : undefined) ?? 'Hub';
    await this.write(card, (raw) =>
      appendReviewNote(raw, `${now.toISOString().slice(0, 10)} ${who}: ${note}`),
    );
  }
}

/** System only: the lab scanner creates these. */
@Injectable()
@CardActionHandler()
export class RedesignCreateAction implements CardActionDefinition<CreateRedesignInput> {
  readonly action = 'redesign.create';
  readonly payload = createRedesignSchema;

  plan({ payload }: CardActionContext<CreateRedesignInput>): CardActionPlan {
    const { detail } = payload;
    return {
      create: {
        title: payload.title,
        body: payload.body ?? null,
        source: 'lab',
        ownerRole: 'owner',
        ...(payload.status ? { status: payload.status } : {}),
        ...(payload.externalKey ? { externalKey: payload.externalKey } : {}),
      },
      detail: defined({
        ...detail,
        touchesComponents: detail.touchesComponents ?? [],
        frontMatter: detail.frontMatter ?? {},
      }),
    };
  }
}

@Injectable()
@CardActionHandler()
export class RedesignSendToReviewAction implements CardActionDefinition<Record<string, never>> {
  readonly action = 'redesign.send_to_review';
  readonly payload = z.object({}) as unknown as z.ZodType<Record<string, never>>;

  constructor(private readonly lab: LabWriteBack) {}

  plan(): CardActionPlan {
    return {
      write: async (card) => {
        await this.lab.setStatus(card, 'review');
      },
      notify: [
        {
          kind: 'review_requested',
          i18nKey: 'review_requested',
          roles: ['owner'],
          data: { action: 'review' },
        },
      ],
    };
  }
}

@Injectable()
@CardActionHandler()
export class RedesignApproveAction implements CardActionDefinition<ApproveRedesignInput> {
  readonly action = 'redesign.approve';
  readonly payload = approveRedesignSchema;
  readonly forbiddenCode = 'hub.redesign.owner_only';

  constructor(
    private readonly cards: CardRepository,
    private readonly lab: LabWriteBack,
  ) {}

  private async portSpecialty(workspaceId: string): Promise<Specialty> {
    const stored = await this.cards.readSetting(workspaceId, 'lab.port_task_specialty');
    const value = String(
      stored === undefined
        ? settingDefault('lab.port_task_specialty')
        : parseSetting('lab.port_task_specialty', stored),
    );
    return (SPECIALTIES as readonly string[]).includes(value) ? (value as Specialty) : 'frontend';
  }

  private portPayload(card: CardView, note: string | undefined, specialty: Specialty) {
    const detail = card.detail ?? {};
    const app = detailText(card, 'app');
    return {
      title: `Port ${app}/${detailText(card, 'page')} ${detailText(card, 'version')}`.slice(0, 200),
      detail: {
        specialty,
        origin: 'redesign_port',
        prompt: renderPortTask({
          labPath: detailText(card, 'labPath'),
          redesignKey: card.key,
          version: detailText(card, 'version'),
          app,
          page: detailText(card, 'page'),
          labUrl: detailText(card, 'labUrl'),
          decisionNote: note ?? null,
          touchesComponents: (detail['touchesComponents'] ?? []) as string[],
          targetRepo: app === 'dashboard' ? 'Goteav-Dashboard' : app,
        }),
      },
    };
  }

  async plan({
    actor,
    card,
    payload,
    now,
  }: CardActionContext<ApproveRedesignInput>): Promise<CardActionPlan> {
    if (!card) throw new Error('redesign.approve needs a card');
    if (card.status !== 'review') throw new AppException('hub.redesign.not_in_review');
    const specialty = payload.createPortTask ? await this.portSpecialty(actor.workspaceId) : null;
    return {
      event: { kind: 'approved', data: payload.note ? { note: payload.note } : {} },
      ...(specialty
        ? {
            prepare: () => [
              {
                action: 'task.create',
                target: null,
                payload: this.portPayload(card, payload.note, specialty),
                trusted: true,
              },
            ],
          }
        : {}),
      write: async (written, prepared) => {
        await this.lab.decide(written, 'approved', actor.userId, now, payload.note);
        const port = prepared[0]?.card ?? null;
        await this.cards.updateDetail(written, {
          approvedById: actor.userId,
          approvedAt: now,
          decisionNote: payload.note ?? null,
          portTaskId: port?.id ?? null,
        });
        if (!port) return {};
        await this.cards.insertLink(
          written,
          { fromCardId: written.id, toCardId: port.id, kind: 'relates' },
          actor.userId,
        );
        return { portTaskKey: port.key };
      },
    };
  }
}

@Injectable()
@CardActionHandler()
export class RedesignRejectAction implements CardActionDefinition<RedesignNoteInput> {
  readonly action = 'redesign.reject';
  readonly payload = redesignNoteSchema;
  readonly forbiddenCode = 'hub.redesign.owner_only';

  constructor(private readonly lab: LabWriteBack) {}

  plan({ actor, card, payload, now }: CardActionContext<RedesignNoteInput>): CardActionPlan {
    if (card?.status !== 'review') throw new AppException('hub.redesign.not_in_review');
    return {
      detail: { rejectedById: actor.userId, rejectedAt: now, decisionNote: payload.note },
      event: { kind: 'rejected', data: { note: payload.note } },
      write: async (written) => {
        await this.lab.decide(written, 'rejected', actor.userId, now, payload.note);
      },
    };
  }
}

/** Status stays `review` (docs/01 §4.1). The note also becomes a comment, where the designer reads it. */
@Injectable()
@CardActionHandler()
export class RedesignRequestChangesAction implements CardActionDefinition<RedesignNoteInput> {
  readonly action = 'redesign.request_changes';
  readonly payload = redesignNoteSchema;

  constructor(
    private readonly cards: CardRepository,
    private readonly lab: LabWriteBack,
  ) {}

  plan({ actor, card, payload, now }: CardActionContext<RedesignNoteInput>): CardActionPlan {
    if (!card) throw new Error('redesign.request_changes needs a card');
    return {
      event: { kind: 'changes_requested', data: { note: payload.note } },
      write: async () => {
        await this.lab.reviewNote(card, actor.userId, now, payload.note);
        const comment = await this.cards.insertComment({ actor, card, body: payload.note, now });
        return { commentId: comment.id };
      },
    };
  }
}

@Injectable()
@CardActionHandler()
export class RedesignMarkPortedAction implements CardActionDefinition<MarkPortedInput> {
  readonly action = 'redesign.mark_ported';
  readonly payload = markPortedSchema;

  constructor(
    private readonly cards: CardRepository,
    private readonly lab: LabWriteBack,
  ) {}

  async plan({ actor, card, payload }: CardActionContext<MarkPortedInput>): Promise<CardActionPlan> {
    if (!card) throw new Error('redesign.mark_ported needs a card');
    const portId = card.detail?.['portTaskId'];
    const port =
      typeof portId === 'string' ? await this.cards.findCard(actor.workspaceId, { cardId: portId }) : null;
    const open = port && port.closedAt === null && !port.archivedAt;
    return {
      detail: { portedRef: payload.ref },
      event: { kind: 'ported', data: { ref: payload.ref } },
      write: async (written) => {
        await this.lab.setStatus(written, 'ported', { ported: payload.ref });
      },
      ...(open
        ? {
            followUps: () => [
              {
                action: 'task.close_as_ported',
                target: { cardId: port.id },
                payload: { ref: payload.ref },
                trusted: true,
              },
            ],
          }
        : {}),
    };
  }
}
