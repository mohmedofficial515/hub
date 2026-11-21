/**
 * @file A plan's explainer video (v5-live-plan, batch 4): asked for from the page, made by a Claude run in Hams' folder with Hams' plan-film engine
 * (the agent queue's `explainer` source), and attached here.
 * @description The film, its poster and its captions are checked like evidence (batch 3): the film from its bytes (MP4 or WebM, the clip cap), the
 * poster drawn again by sharp, the captions plain WebVTT text. They are stored as attachments of the plan card, then named on the plan; if that
 * fails they are removed again. Once a new film is attached, the one it replaced is removed.
 */
import {
  type ExplainerRequest,
  type MemberActor,
  PLAN_EXPLAINER_LIMITS,
  type PlanExplainer,
} from '@hub/contracts';
import { Injectable } from '@nestjs/common';

import { type ApplyResult, CardQueryService, CardService } from '@/modules/cards';
import { AppException } from '@/shared/errors';

import { readEvidenceFile } from '../domain/evidence-media';
import { AttachmentStore, type StoredFile } from './attachment-store';
import { redrawImage } from './evidence-image';

export interface ExplainerFile {
  data: Buffer;
  name: string;
}

export interface ExplainerUpload {
  revision: number;
  video: ExplainerFile;
  poster?: ExplainerFile | undefined;
  captions?: ExplainerFile | undefined;
  /** As plan-film writes them: `phase` is the plan's phase number, null for the intro and the close. */
  chapters: readonly { phase: number | null; title?: string | undefined; start: number }[];
  hamsProject?: { id: string; url: string } | undefined;
}

/** WebVTT as text: a BOM dropped, the header checked, nothing else touched. A track is shown as text by the browser and never runs. */
export function readCaptions(data: Buffer): Buffer {
  if (data.length > PLAN_EXPLAINER_LIMITS.captionsBytes)
    throw new AppException('hub.plans.evidence_too_large');
  const text = data.toString('utf8').trimStart();
  if (!/^WEBVTT(?:[ \t].*)?(?:\r?\n|$)/.test(text) || text.includes('\u0000')) {
    throw new AppException('hub.plans.explainer_captions');
  }
  return Buffer.from(text, 'utf8');
}

@Injectable()
export class PlanExplainerService {
  constructor(
    private readonly cards: CardService,
    private readonly query: CardQueryService,
    private readonly store: AttachmentStore,
  ) {}

  /** Asks for the film of the plan as it is now. */
  request(actor: MemberActor, key: string, request: ExplainerRequest): Promise<ApplyResult> {
    return this.cards.apply(actor, { cardKey: key }, 'plan.request_explainer', { request });
  }

  /** Stores the film, its poster and its captions, and names them on the plan. */
  async attach(actor: MemberActor, slug: string, key: string, upload: ExplainerUpload): Promise<ApplyResult> {
    const card = await this.query.full(actor, key);
    if (card.type !== 'plan') throw new AppException('hub.cards.type_mismatch');
    if (!card.allowedActions.includes('plan.attach_explainer')) {
      throw new AppException('hub.common.forbidden', { details: { action: 'plan.attach_explainer' } });
    }
    const detail = card.detail as { explainer?: PlanExplainer | null; phases?: { id: string }[] } | null;
    const before = detail?.explainer ?? null;
    if (!before || before.status !== 'requested') throw new AppException('hub.plans.explainer_not_requested');
    if (upload.revision !== before.revision) {
      throw new AppException('hub.plans.explainer_stale', {
        params: { revision: String(upload.revision), asked: String(before.revision) },
      });
    }

    // The explainer's own cap (owner, 2026-11-20): larger than a step's clip.
    const video = readEvidenceFile(upload.video.data, PLAN_EXPLAINER_LIMITS.videoBytes);
    if ('refused' in video) {
      throw new AppException(
        video.refused === 'too_large' ? 'hub.plans.evidence_too_large' : 'hub.plans.evidence_type',
      );
    }
    if (!video.mime.startsWith('video/')) throw new AppException('hub.plans.evidence_kind');
    if (video.data.length > PLAN_EXPLAINER_LIMITS.videoBytes)
      throw new AppException('hub.plans.evidence_too_large');

    const files: StoredFile[] = [
      { kind: 'explainer', name: upload.video.name, mime: video.mime, data: video.data },
    ];
    if (upload.poster) {
      const poster = readEvidenceFile(upload.poster.data);
      if ('refused' in poster || poster.mime.startsWith('video/'))
        throw new AppException('hub.plans.evidence_type');
      const drawn = await redrawImage(
        poster.data,
        poster.mime as 'image/png' | 'image/jpeg' | 'image/webp',
      ).catch((cause: unknown) => {
        throw new AppException('hub.plans.evidence_damaged', { cause });
      });
      files.push({
        kind: 'explainer_poster',
        name: upload.poster.name,
        mime: poster.mime,
        data: drawn.data,
        width: drawn.width,
        height: drawn.height,
      });
    }
    if (upload.captions) {
      files.push({
        kind: 'explainer_captions',
        name: upload.captions.name,
        mime: 'text/vtt',
        data: readCaptions(upload.captions.data),
      });
    }

    // A chapter names its phase by id on the plan; a number the plan does not have reads as no phase.
    const phases = detail?.phases ?? [];
    const chapters = upload.chapters.map((chapter) => ({
      phaseId: chapter.phase === null ? null : (phases[chapter.phase]?.id ?? null),
      ...(chapter.title ? { title: chapter.title } : {}),
      start: chapter.start,
    }));

    const ids = await this.store.store(card, slug, files);
    const [attachmentId, ...rest] = ids;
    const posterId = upload.poster ? rest.shift() : undefined;
    const captionsId = upload.captions ? rest.shift() : undefined;
    let result: ApplyResult;
    try {
      result = await this.cards.apply(actor, { cardKey: key }, 'plan.attach_explainer', {
        revision: upload.revision,
        attachmentId,
        ...(posterId ? { posterId } : {}),
        ...(captionsId ? { captionsId } : {}),
        chapters,
        ...(upload.hamsProject ? { hamsProject: upload.hamsProject } : {}),
      });
    } catch (error) {
      await this.store.forget(ids, card.id);
      throw error;
    }
    // The film this one replaces, and its poster and captions.
    const old = before.previous;
    if (old) {
      await this.store.forget(
        [old.attachmentId, old.posterId, old.captionsId].filter((id): id is string => !!id),
        card.id,
      );
    }
    return result;
  }
}
