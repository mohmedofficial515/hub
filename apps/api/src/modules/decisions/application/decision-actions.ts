/**
 * @file Decision actions (docs/04 §3.11). The deadline defaults from `decisions.default_due_days`, and an ADR skeleton
 * is rendered on decide. A decided decision unblocks its dependants through `apply`, like every closed blocker.
 */
import { randomUUID } from 'node:crypto';

import {
  type CreateDecisionInput,
  createDecisionSchema,
  type DecideInput,
  decideSchema,
  type DecisionOption,
  type DecisionOptionInput,
  type DraftAdrInput,
  draftAdrSchema,
  type EditDecisionOptionsInput,
  editDecisionOptionsSchema,
  parseSetting,
  settingDefault,
  type SupersedeDecisionInput,
  supersedeDecisionSchema,
} from '@hub/contracts';
import { Inject, Injectable } from '@nestjs/common';

import { APP_CONFIG, type AppConfig } from '@/config/config.module';
import {
  baseCreateFields,
  type CardActionContext,
  type CardActionDefinition,
  CardActionHandler,
  type CardActionPlan,
  CardRepository,
  detailText,
  linkFollowUps,
  ReasonTransition,
} from '@/modules/cards';
import { AppException } from '@/shared/errors';

import { renderAdr, type TemplateLocale } from './adr.template';

const DAY_MS = 86_400_000;

function slugOf(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

/** Ids are kept when given, otherwise a slug of the title; a title with no latin letters gets a generated id. */
export function normalizeOptions(inputs: readonly DecisionOptionInput[]): DecisionOption[] {
  if (inputs.length < 2) throw new AppException('hub.decisions.options_min');
  const used = new Set<string>();
  return inputs.map((input) => {
    let id = input.id ?? slugOf(input.title);
    if (!id || used.has(id)) id = `option-${randomUUID().slice(0, 8)}`;
    used.add(id);
    return {
      id,
      title: input.title,
      pros: input.pros ?? [],
      cons: input.cons ?? [],
      cost: input.cost ?? null,
      recommended: input.recommended ?? false,
    };
  });
}

@Injectable()
@CardActionHandler()
export class DecisionCreateAction implements CardActionDefinition<CreateDecisionInput> {
  readonly action = 'decision.create';
  readonly payload = createDecisionSchema;

  constructor(private readonly cards: CardRepository) {}

  async plan({ actor, payload, now }: CardActionContext<CreateDecisionInput>): Promise<CardActionPlan> {
    const { detail } = payload;
    const stored = await this.cards.readSetting(actor.workspaceId, 'decisions.default_due_days');
    const days = Number(
      stored === undefined
        ? settingDefault('decisions.default_due_days')
        : parseSetting('decisions.default_due_days', stored),
    );
    const followUps = linkFollowUps(payload.links);
    return {
      create: {
        ...baseCreateFields(payload),
        ownerRole: detail.deciderRole,
        dueAt: payload.dueAt ? new Date(payload.dueAt) : new Date(now.getTime() + days * DAY_MS),
      },
      detail: {
        kind: detail.kind,
        question: detail.question,
        options: normalizeOptions(detail.options),
        deciderRole: detail.deciderRole,
        adrRepoSourceId: detail.adrRepoSourceId ?? null,
      },
      ...(followUps ? { followUps } : {}),
      notify: [
        {
          kind: 'routed_decision',
          i18nKey: 'routed_decision',
          roles: [detail.deciderRole],
          data: { action: 'decide' },
        },
      ],
    };
  }
}

@Injectable()
@CardActionHandler()
export class DecisionEditOptionsAction implements CardActionDefinition<EditDecisionOptionsInput> {
  readonly action = 'decision.edit_options';
  readonly payload = editDecisionOptionsSchema;

  plan({ card, payload }: CardActionContext<EditDecisionOptionsInput>): CardActionPlan {
    if (card?.status !== 'open') throw new AppException('hub.decisions.already_decided');
    const options = normalizeOptions(payload.options);
    return {
      detail: { options },
      event: {
        kind: 'field_changed',
        data: { changes: [{ field: 'options', to: options.map((option) => option.id) }] },
      },
    };
  }
}

@Injectable()
@CardActionHandler()
export class DecisionDecideAction implements CardActionDefinition<DecideInput> {
  readonly action = 'decision.decide';
  readonly payload = decideSchema;
  readonly forbiddenCode = 'hub.decisions.not_decider';

  constructor(
    private readonly cards: CardRepository,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async plan({ actor, card, payload, now }: CardActionContext<DecideInput>): Promise<CardActionPlan> {
    if (!card) throw new Error('decision.decide needs a card');
    if (card.status === 'decided') throw new AppException('hub.decisions.already_decided');
    const detail = card.detail ?? {};
    const options = (detail['options'] ?? []) as DecisionOption[];
    const chosen = options.find((option) => option.id === payload.optionId);
    if (!chosen) throw new AppException('hub.decisions.option_not_found');

    const adr = detail['adrBody'] ? {} : await this.adrSkeleton(actor.userId, card, options, payload, now);
    return {
      detail: {
        chosenOptionId: chosen.id,
        rationale: payload.rationale,
        decidedById: actor.userId,
        decidedAt: now,
        ...adr,
      },
      event: {
        kind: 'decided',
        data: { optionId: chosen.id, optionTitle: chosen.title, rationale: payload.rationale },
      },
    };
  }

  private async adrSkeleton(
    userId: string | null,
    card: NonNullable<CardActionContext<DecideInput>['card']>,
    options: readonly DecisionOption[],
    payload: DecideInput,
    now: Date,
  ) {
    const workspace = await this.cards.findWorkspace(card.workspaceId);
    const [names, unblocked] = await Promise.all([
      this.cards.findUserNames(userId ? [userId] : []),
      this.cards.findDependants(card),
    ]);
    const locale: TemplateLocale = workspace?.defaultLocale === 'ar' ? 'ar' : 'en';
    return {
      adrStatus: 'drafted',
      adrBody: renderAdr(
        {
          key: card.key,
          title: card.title,
          decidedDate: now.toISOString().slice(0, 10),
          deciderRole: detailText(card, 'deciderRole', card.ownerRole ?? ''),
          decidedBy: (userId && names.get(userId)) || '',
          hubUrl: `${this.config.HUB_PUBLIC_URL}/${locale}/${workspace?.slug ?? ''}/cards/${card.key}`,
          question: detailText(card, 'question'),
          body: card.body,
          options: options.map((option) => ({
            title: option.title,
            pros: option.pros,
            cons: option.cons,
            chosen: option.id === payload.optionId,
          })),
          rationale: payload.rationale,
          unblocked: unblocked.map((item) => ({ key: item.key, title: item.title })),
        },
        locale,
      ),
    };
  }
}

@Injectable()
@CardActionHandler()
export class DecisionWithdrawAction extends ReasonTransition {
  readonly action = 'decision.withdraw';
}

@Injectable()
@CardActionHandler()
export class DecisionSupersedeAction implements CardActionDefinition<SupersedeDecisionInput> {
  readonly action = 'decision.supersede';
  readonly payload = supersedeDecisionSchema;

  constructor(private readonly cards: CardRepository) {}

  async plan({ actor, card, payload }: CardActionContext<SupersedeDecisionInput>): Promise<CardActionPlan> {
    if (!card) throw new Error('decision.supersede needs a card');
    const by = await this.cards.findCard(actor.workspaceId, { cardKey: payload.byKey });
    if (!by || by.archivedAt) throw new AppException('hub.cards.not_found');
    if (by.type !== 'decision') throw new AppException('hub.cards.type_mismatch');
    const edge = { fromCardId: card.id, toCardId: by.id, kind: 'relates' };
    const reversed = { fromCardId: by.id, toCardId: card.id, kind: 'relates' };
    const linked = (await this.cards.findLink(card, edge)) || (await this.cards.findLink(card, reversed));
    return {
      event: { kind: 'status_changed', data: { byKey: payload.byKey } },
      ...(linked
        ? {}
        : {
            followUps: () => [
              {
                action: 'card.link',
                target: { cardId: card.id },
                payload: { op: 'add', kind: 'relates', key: payload.byKey },
                trusted: true,
              },
            ],
          }),
    };
  }
}

@Injectable()
@CardActionHandler()
export class DecisionDraftAdrAction implements CardActionDefinition<DraftAdrInput> {
  readonly action = 'decision.draft_adr';
  readonly payload = draftAdrSchema;

  plan({ payload }: CardActionContext<DraftAdrInput>): CardActionPlan {
    return {
      detail: {
        adrBody: payload.body,
        adrStatus: 'drafted',
        ...(payload.path ? { adrPath: payload.path } : {}),
      },
      event: { kind: 'field_changed', data: { changes: [{ field: 'adrBody' }] } },
    };
  }
}
