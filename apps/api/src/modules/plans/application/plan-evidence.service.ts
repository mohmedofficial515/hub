/**
 * @file A plan step's evidence (v5-live-plan, batch 3): a picture or a clip stored as an attachment of the plan card and named on the step.
 * @description The file is read from its own bytes (`evidence-media.ts`): a picture is kept without its metadata, a clip as it came, anything else
 * refused. The member's right is checked before anything is stored. The bytes go in their own transaction, because `CardService.apply` must be
 * the outermost one; if the action then fails, the stored file is removed again, so nothing is left without a step. Removing evidence takes it off
 * the step first and then deletes the bytes, so a failed removal never leaves a step naming a missing file.
 */
import { createHash } from 'node:crypto';

import {
  type AddStepEvidenceInput,
  type ErrorCode,
  type MemberActor,
  type PlanStep,
  type PlanStepEvidence,
} from '@hub/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';

import { CLOCK, type Clock } from '@/infra/clock/clock';
import { type PrismaTransactionalAdapter } from '@/infra/prisma/prisma.module';
import { type ApplyResult, CardQueryService, CardService } from '@/modules/cards';
import { AppException } from '@/shared/errors';

import {
  type EvidenceFile,
  type EvidenceRefusal,
  kindFits,
  readEvidenceFile,
} from '../domain/evidence-media';
import { redrawImage } from './evidence-image';

const REFUSED: Record<EvidenceRefusal, ErrorCode> = {
  type: 'hub.plans.evidence_type',
  too_large: 'hub.plans.evidence_too_large',
  damaged: 'hub.plans.evidence_damaged',
};

export interface EvidenceUpload extends AddStepEvidenceInput {
  data: Buffer;
  /** The name the file came with, kept as the attachment's name. */
  name: string;
  via: 'web' | 'mcp';
}

export interface AttachmentFile {
  mime: string;
  data: Buffer;
  etag: string;
}

/** Where the API serves an attachment's bytes, as the web reads it. */
export const attachmentFileUrl = (slug: string, key: string, id: string) =>
  `/api/v1/workspaces/${slug}/cards/${key}/attachments/${id}/file`;

@Injectable()
export class PlanEvidenceService {
  constructor(
    private readonly txHost: TransactionHost<PrismaTransactionalAdapter>,
    private readonly cards: CardService,
    private readonly query: CardQueryService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** Stores the file and names it on the step. `slug` is the project's, for the attachment's address. */
  async add(
    actor: MemberActor,
    slug: string,
    key: string,
    stepId: string,
    upload: EvidenceUpload,
  ): Promise<ApplyResult> {
    const card = await this.query.full(actor, key);
    if (card.type !== 'plan') throw new AppException('hub.cards.type_mismatch');
    if (!card.allowedActions.includes('plan.add_evidence')) {
      throw new AppException('hub.common.forbidden', { details: { action: 'plan.add_evidence' } });
    }
    const steps = (card.detail as { steps?: PlanStep[] } | null)?.steps ?? [];
    if (!steps.some((step) => step.id === stepId)) throw new AppException('hub.plans.step_not_found');

    // The bytes first (what the file is, its size, that it parses), then a picture drawn again by sharp.
    const checked = readEvidenceFile(upload.data);
    if ('refused' in checked) throw new AppException(REFUSED[checked.refused]);
    if (!kindFits(checked.mime, upload.kind)) throw new AppException('hub.plans.evidence_kind');
    const file = await this.redrawn(checked);

    const name = (upload.name.split(/[\\/]/).pop() ?? '').slice(0, 200) || `${upload.kind}`;
    const attachment = await this.txHost.withTransaction(async () => {
      const row = await this.txHost.tx.cardAttachment.create({
        data: {
          cardId: card.id,
          kind: 'evidence',
          name,
          url: '',
          mime: file.mime,
          width: file.width,
          height: file.height,
          file: {
            create: {
              data: new Uint8Array(file.data),
              size: file.data.length,
              sha256: createHash('sha256').update(file.data).digest('hex'),
              ...(file.thumb ? { thumb: new Uint8Array(file.thumb) } : {}),
            },
          },
        },
        select: { id: true },
      });
      await this.txHost.tx.cardAttachment.update({
        where: { id: row.id },
        data: { url: attachmentFileUrl(slug, card.key, row.id) },
      });
      return row;
    });

    const evidence: PlanStepEvidence = {
      attachmentId: attachment.id,
      kind: upload.kind,
      ...(upload.caption ? { caption: upload.caption } : {}),
      mime: file.mime,
      width: file.width,
      height: file.height,
      addedAt: this.clock.now().toISOString(),
      via: upload.via,
      addedBy: actor.userId,
      ...(file.thumb ? { thumb: true } : {}),
    };
    try {
      return await this.cards.apply(actor, { cardKey: key }, 'plan.add_evidence', { stepId, evidence });
    } catch (error) {
      await this.forget(attachment.id);
      throw error;
    }
  }

  /**
   * Takes the file off the step, then removes its bytes. The plan's owner, a pm and its creator remove any file; anyone else only a file they
   * added, which the action checks on the file itself.
   */
  async remove(actor: MemberActor, key: string, stepId: string, attachmentId: string): Promise<ApplyResult> {
    const card = await this.query.full(actor, key);
    const action = card.allowedActions.includes('plan.remove_evidence')
      ? 'plan.remove_evidence'
      : 'plan.remove_own_evidence';
    const result = await this.cards.apply(actor, { cardKey: key }, action, { stepId, attachmentId });
    await this.forget(attachmentId, result.card.id);
    return result;
  }

  /** An uploaded attachment's bytes, or its thumbnail, for a member who may read its card. A clip has no thumbnail. */
  async file(
    actor: MemberActor,
    key: string,
    attachmentId: string,
    size: 'full' | 'thumb' = 'full',
  ): Promise<AttachmentFile> {
    const card = await this.query.readable(actor, { cardKey: key });
    const found = await this.txHost.tx.cardAttachment.findFirst({
      where: { id: attachmentId, cardId: card.id },
      select: { mime: true, file: { select: { data: true, sha256: true, thumb: true } } },
    });
    if (!found?.file || !found.mime) throw new AppException('hub.plans.evidence_not_found');
    if (size === 'thumb') {
      if (!found.file.thumb) throw new AppException('hub.plans.evidence_not_found');
      return {
        mime: 'image/webp',
        data: Buffer.from(found.file.thumb),
        etag: `"${found.file.sha256.slice(0, 30)}-t"`,
      };
    }
    return {
      mime: found.mime,
      data: Buffer.from(found.file.data),
      etag: `"${found.file.sha256.slice(0, 32)}"`,
    };
  }

  /** A picture drawn again with its thumbnail; a clip as it is. A picture sharp cannot read is damaged. */
  private async redrawn(file: EvidenceFile): Promise<EvidenceFile & { thumb: Buffer | null }> {
    if (file.mime === 'video/mp4' || file.mime === 'video/webm') return { ...file, thumb: null };
    try {
      const image = await redrawImage(file.data, file.mime);
      return {
        mime: file.mime,
        data: image.data,
        width: image.width,
        height: image.height,
        thumb: image.thumb,
      };
    } catch (cause) {
      throw new AppException('hub.plans.evidence_damaged', { cause });
    }
  }

  private async forget(attachmentId: string, cardId?: string) {
    await this.txHost.withTransaction(() =>
      this.txHost.tx.cardAttachment.deleteMany({
        where: { id: attachmentId, ...(cardId ? { cardId } : {}) },
      }),
    );
  }
}
