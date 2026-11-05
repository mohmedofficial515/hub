/**
 * @file Need actions (docs/04 §3.12). `location` says where a value was put, never the value, and `apply` runs it
 * through the secret filter. D24: whoever delivered may verify, with a required note, and the event says so.
 */
import {
  type CreateNeedInput,
  createNeedSchema,
  type DeliverNeedInput,
  deliverNeedSchema,
  type VerifyNeedInput,
  verifyNeedSchema,
} from '@hub/contracts';
import { Injectable } from '@nestjs/common';

import {
  baseCreateFields,
  type CardActionContext,
  type CardActionDefinition,
  CardActionHandler,
  type CardActionPlan,
  linkFollowUps,
  PlainTransition,
  ReasonTransition,
} from '@/modules/cards';
import { AppException } from '@/shared/errors';

@Injectable()
@CardActionHandler()
export class NeedCreateAction implements CardActionDefinition<CreateNeedInput> {
  readonly action = 'need.create';
  readonly payload = createNeedSchema;

  plan({ payload }: CardActionContext<CreateNeedInput>): CardActionPlan {
    const { detail } = payload;
    const followUps = linkFollowUps(payload.links);
    return {
      create: { ...baseCreateFields(payload), ownerRole: detail.responsibleRole },
      detail: { kind: detail.kind, responsibleRole: detail.responsibleRole },
      ...(followUps ? { followUps } : {}),
      notify: [
        {
          kind: 'routed_need',
          i18nKey: 'routed_need',
          roles: [detail.responsibleRole],
          data: { action: 'deliver' },
        },
      ],
    };
  }
}

@Injectable()
@CardActionHandler()
export class NeedStartAction extends PlainTransition {
  readonly action = 'need.start';
  readonly forbiddenCode = 'hub.needs.not_responsible';
}

@Injectable()
@CardActionHandler()
export class NeedDeliverAction implements CardActionDefinition<DeliverNeedInput> {
  readonly action = 'need.deliver';
  readonly payload = deliverNeedSchema;
  readonly forbiddenCode = 'hub.needs.not_responsible';

  plan({ actor, payload, now }: CardActionContext<DeliverNeedInput>): CardActionPlan {
    if (!payload.location) throw new AppException('hub.needs.location_required');
    return {
      detail: { location: payload.location, deliveredById: actor.userId, deliveredAt: now },
      event: {
        kind: 'delivered',
        data: { location: payload.location, ...(payload.note ? { note: payload.note } : {}) },
      },
    };
  }
}

@Injectable()
@CardActionHandler()
export class NeedVerifyAction implements CardActionDefinition<VerifyNeedInput> {
  readonly action = 'need.verify';
  readonly payload = verifyNeedSchema;

  plan({ actor, card, payload, now }: CardActionContext<VerifyNeedInput>): CardActionPlan {
    const selfVerified = card?.detail?.['deliveredById'] === actor.userId;
    if (selfVerified && !payload.note) throw new AppException('hub.needs.self_verify_note_required');
    return {
      detail: { verifiedById: actor.userId, verifiedAt: now, verificationNote: payload.note ?? null },
      event: {
        kind: 'verified',
        data: { ...(payload.note ? { note: payload.note } : {}), ...(selfVerified ? { selfVerified } : {}) },
      },
    };
  }
}

@Injectable()
@CardActionHandler()
export class NeedRejectDeliveryAction extends ReasonTransition {
  readonly action = 'need.reject_delivery';

  override plan(context: Parameters<ReasonTransition['plan']>[0]): CardActionPlan {
    return {
      ...super.plan(context),
      // Whoever delivers next is who may self-verify.
      detail: { deliveredById: null, deliveredAt: null },
    };
  }
}

@Injectable()
@CardActionHandler()
export class NeedCancelAction extends ReasonTransition {
  readonly action = 'need.cancel';
}
