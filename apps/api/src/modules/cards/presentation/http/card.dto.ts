/**
 * @file HTTP shapes of the generic card routes.
 * @description To accept another type on `POST /cards`, add its schema with `type` to the union. Types only
 * adapters create are in the union so that they answer 409 `hub.cards.type_mismatch` (docs/04 §3.8), not 400.
 */
import {
  cardFullSchema,
  cardQuerySchema,
  cardSummarySchema,
  type CardType,
  cardWrittenSchema,
  commentBodySchema,
  commentSchema,
  createDecisionSchema,
  createHandoffSchema,
  createIdeaSchema,
  createNeedSchema,
  createPlanSchema,
  createReleaseSchema,
  createTaskSchema,
  eventSchema,
  linkInputSchema,
  optionalReasonSchema,
  pageQuerySchema,
  timelineQuerySchema,
  timelineRowSchema,
  transitionSchema,
  updateCardSchema,
} from '@hub/contracts';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const createCardBodySchema = z.discriminatedUnion('type', [
  createTaskSchema.extend({ type: z.literal('task') }),
  createDecisionSchema.extend({ type: z.literal('decision') }),
  createNeedSchema.extend({ type: z.literal('need') }),
  createHandoffSchema.extend({ type: z.literal('handoff') }),
  createReleaseSchema.extend({ type: z.literal('release') }),
  createIdeaSchema.extend({ type: z.literal('idea') }),
  createPlanSchema.extend({ type: z.literal('plan') }),
  z.object({ type: z.enum(['change', 'redesign', 'doc']) }),
]);

/** A union has no statically known members to extend, so the base is typed by what the route reads. */
const CreateCardBase = createZodDto(createCardBodySchema) as unknown as new () => { readonly type: CardType };
export class CreateCardDto extends CreateCardBase {}
export class UpdateCardDto extends createZodDto(updateCardSchema) {}
export class TransitionDto extends createZodDto(transitionSchema) {}
export class DeleteCardDto extends createZodDto(optionalReasonSchema) {}
export class CommentBodyDto extends createZodDto(commentBodySchema) {}
export class LinkDto extends createZodDto(linkInputSchema) {}
export class CardQueryDto extends createZodDto(cardQuerySchema) {}
export class PageQueryDto extends createZodDto(pageQuerySchema) {}
export class TimelineQueryDto extends createZodDto(timelineQuerySchema) {}

export class CardSummaryDto extends createZodDto(cardSummarySchema) {}
export class CardFullResponseDto extends createZodDto(cardFullSchema) {}
export class CardWrittenResponseDto extends createZodDto(cardWrittenSchema) {}
export class CommentResponseDto extends createZodDto(commentSchema) {}
export class EventResponseDto extends createZodDto(eventSchema) {}
export class TimelineRowDto extends createZodDto(timelineRowSchema) {}
