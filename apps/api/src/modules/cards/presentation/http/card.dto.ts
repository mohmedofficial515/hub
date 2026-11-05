/**
 * @file HTTP shapes of the generic card routes.
 * @description To accept another type on `POST /cards`, add its schema with `type` to the union.
 * H0-05 grows `CardWrittenDto` into `CardFull` (docs/04 §1.8).
 */
import { CARD_TYPES, createTaskSchema } from '@hub/contracts';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const createCardBodySchema = z.discriminatedUnion('type', [
  createTaskSchema.extend({ type: z.literal('task') }),
]);

export class CreateCardDto extends createZodDto(createCardBodySchema) {}

export const cardWrittenSchema = z.object({
  id: z.string(),
  key: z.string(),
  type: z.enum(CARD_TYPES),
  title: z.string(),
  body: z.string().nullable(),
  status: z.string(),
  priority: z.string(),
  ownerRole: z.string().nullable(),
  assigneeId: z.string().nullable(),
  lastEventAt: z.string(),
  createdAt: z.string(),
  event: z.object({ id: z.string(), seq: z.number().int(), kind: z.string() }),
});

export class CardWrittenDto extends createZodDto(cardWrittenSchema) {}
