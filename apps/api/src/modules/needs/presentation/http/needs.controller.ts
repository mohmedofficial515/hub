/**
 * @file Need routes (docs/04 §3.12).
 */
import {
  deliverNeedSchema,
  type MemberActor,
  NEED_STATUSES,
  type PermissionAction,
  queryFlag,
  queryList,
  reasonSchema,
  roleSchema,
  verifyNeedSchema,
} from '@hub/contracts';
import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { CardQueryService, CardService, CardWrittenResponseDto } from '@/modules/cards';
import { Actor, Permissions } from '@/shared/http';

class NeedsQueryDto extends createZodDto(
  z.object({
    status: queryList(z.enum(NEED_STATUSES)),
    responsibleRole: queryList(roleSchema),
    mine: queryFlag,
    stale: queryFlag,
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  }),
) {}
class DeliverDto extends createZodDto(deliverNeedSchema) {}
class VerifyDto extends createZodDto(verifyNeedSchema) {}
class ReasonDto extends createZodDto(reasonSchema) {}

@ApiTags('needs')
@Controller('workspaces/:ws/needs')
export class NeedsController {
  constructor(
    private readonly cards: CardService,
    private readonly query: CardQueryService,
  ) {}

  private async run(actor: MemberActor, key: string, action: PermissionAction, payload: unknown) {
    return this.query.written(actor, await this.cards.apply(actor, { cardKey: key }, action, payload));
  }

  @Get()
  @Permissions('card.read')
  @ApiOperation({ summary: 'Needs, urgent first, with what each blocks' })
  async list(@Actor() actor: MemberActor, @Query() query: NeedsQueryDto) {
    const page = await this.query.listWithDetail(actor, 'need', {
      statuses: query.status ?? ['requested', 'in_progress', 'delivered'],
      roles: query.mine ? actor.roles : query.responsibleRole,
      flags: query.stale ? ['stale'] : undefined,
      sort: 'priority',
      cursor: query.cursor,
      limit: query.limit,
    });
    const blocks = await this.query.blocksOf(
      actor,
      page.items.map((card) => card.id),
    );
    return { ...page, items: page.items.map((card) => ({ ...card, blocks: blocks.get(card.id) ?? [] })) };
  }

  @Post(':key/start')
  @HttpCode(200)
  @Permissions('need.start')
  @ApiOperation({ summary: 'Start working on a need' })
  @ApiOkResponse({ type: CardWrittenResponseDto })
  start(@Actor() actor: MemberActor, @Param('key') key: string) {
    return this.run(actor, key, 'need.start', {});
  }

  @Post(':key/deliver')
  @HttpCode(200)
  @Permissions('need.deliver')
  @ApiOperation({ summary: 'Say where the value was put. Never the value itself.' })
  @ApiOkResponse({ type: CardWrittenResponseDto })
  deliver(@Actor() actor: MemberActor, @Param('key') key: string, @Body() body: DeliverDto) {
    return this.run(actor, key, 'need.deliver', body);
  }

  @Post(':key/verify')
  @HttpCode(200)
  @Permissions('need.verify')
  @ApiOperation({ summary: 'Verify a delivery. Your own needs a note (D24).' })
  @ApiOkResponse({ type: CardWrittenResponseDto })
  verify(@Actor() actor: MemberActor, @Param('key') key: string, @Body() body: VerifyDto) {
    return this.run(actor, key, 'need.verify', body);
  }

  @Post(':key/reject-delivery')
  @HttpCode(200)
  @Permissions('need.reject_delivery')
  @ApiOperation({ summary: 'Send a delivery back, with a reason' })
  @ApiOkResponse({ type: CardWrittenResponseDto })
  reject(@Actor() actor: MemberActor, @Param('key') key: string, @Body() body: ReasonDto) {
    return this.run(actor, key, 'need.reject_delivery', body);
  }

  @Post(':key/cancel')
  @HttpCode(200)
  @Permissions('need.cancel')
  @ApiOperation({ summary: 'Cancel a need, with a reason' })
  @ApiOkResponse({ type: CardWrittenResponseDto })
  cancel(@Actor() actor: MemberActor, @Param('key') key: string, @Body() body: ReasonDto) {
    return this.run(actor, key, 'need.cancel', body);
  }
}
