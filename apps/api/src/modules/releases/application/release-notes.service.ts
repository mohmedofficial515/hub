/**
 * @file `generate-notes`: fills only the audiences still empty, from the release's included cards (docs/07 §6.3).
 */
import { type Actor, type EditReleaseInput, RELEASE_AUDIENCES } from '@hub/contracts';
import { Injectable } from '@nestjs/common';

import {
  type ApplyResult,
  CardReader,
  CardRepository,
  CardService,
  type CardView,
  type JsonObject,
} from '@/modules/cards';
import { AppException } from '@/shared/errors';

import { type ReleaseNoteCard, renderReleaseNotes, type TemplateLocale } from './release-notes.template';

const OPEN_LIMIT = 200;

function chosenOption(card: CardView): string | null {
  const detail = card.detail ?? {};
  const options = (detail['options'] ?? []) as { id: string; title: string }[];
  return options.find((option) => option.id === detail['chosenOptionId'])?.title ?? null;
}

function toNoteCard(card: CardView): ReleaseNoteCard {
  const detail = card.detail ?? {};
  return {
    key: card.key,
    title: card.title,
    type: card.type,
    status: card.status,
    priority: card.priority,
    ownerRole: card.ownerRole,
    module: card.module,
    tags: card.tags,
    prUrl: typeof detail['prUrl'] === 'string' ? detail['prUrl'] : null,
    kind: typeof detail['kind'] === 'string' ? detail['kind'] : null,
    chosenOption: card.type === 'decision' ? chosenOption(card) : null,
  };
}

@Injectable()
export class ReleaseNotesService {
  constructor(
    private readonly cards: CardService,
    private readonly repository: CardRepository,
    private readonly reader: CardReader,
  ) {}

  async generate(actor: Actor, key: string): Promise<ApplyResult> {
    const release = await this.repository.findCard(actor.workspaceId, { cardKey: key });
    if (!release) throw new AppException('hub.cards.not_found');
    if (release.type !== 'release') throw new AppException('hub.cards.type_mismatch');

    const detail: JsonObject = release.detail ?? {};
    const ids = (detail['includedIds'] ?? []) as string[];
    const included = await this.reader.findByIds(actor.workspaceId, ids);
    const now = new Date();
    const open = await this.reader.findCandidates(
      actor.workspaceId,
      { now, staleHandoffBefore: now, staleNeedBefore: now },
      {
        OR: [
          { type: 'decision', status: 'open' },
          { type: 'need', status: { in: ['requested', 'in_progress', 'delivered'] } },
        ],
      },
      OPEN_LIMIT,
    );
    const workspace = await this.repository.findWorkspace(actor.workspaceId);
    const locale: TemplateLocale = workspace?.defaultLocale === 'en' ? 'en' : 'ar';

    const notes = (detail['notes'] ?? {}) as Record<string, string | null | undefined>;
    const filled: NonNullable<EditReleaseInput['notes']> = {};
    for (const audience of RELEASE_AUDIENCES) {
      if (!notes[audience]) {
        filled[audience] = renderReleaseNotes(
          audience,
          included.map(toNoteCard),
          open.map(toNoteCard),
          locale,
        );
      }
    }
    return this.cards.apply(actor, { cardId: release.id }, 'release.edit', { notes: filled });
  }
}
