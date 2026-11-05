/**
 * @file Decision routes (docs/04 §3.11). Opening the ADR pull request arrives with H3-06, which needs a token.
 */
import {
  decideSchema,
  DECISION_STATUSES,
  draftAdrSchema,
  editDecisionOptionsSchema,
  type MemberActor,
  type PermissionAction,
  queryFlag,
  queryList,
  reasonSchema,
  roleSchema,
  supersedeDecisionSchema,
} from '@hub/contracts';
import { Body, Controller, Get, HttpCode, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { CardQueryService, CardService, CardWrittenResponseDto } from '@/modules/cards';
import { Actor, Permissions } from '@/shared/http';

class DecisionsQueryDto extends createZodDto(
  z.object({
    status: queryList(z.enum(DECISION_STATUSES)),
    deciderRole: queryList(roleSchema),
    mine: queryFlag,
    overdue: queryFlag,
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  }),
) {}
class OptionsDto extends createZodDto(editDecisionOptionsSchema) {}
class DecideDto extends createZodDto(decideSchema) {}
class ReasonDto extends createZodDto(reasonSchema) {}
class SupersedeDto extends createZodDto(supersedeDecisionSchema) {}
class DraftAdrDto extends createZodDto(draftAdrSchema) {}

@ApiTags('decisions')
@Controller('workspaces/:ws/decisions')
export class DecisionsController {
  constructor(
    private readonly cards: CardService,
    private readonly query: CardQueryService,
  ) {}

  private async run(actor: MemberActor, key: string, action: PermissionAction, payload: unknown) {
    return this.query.written(actor, await this.cards.apply(actor, { cardKey: key }, action, payload));
  }

  @Get()
  @Permissions('card.read')
  @ApiOperation({ summary: 'Decisions, open ones by deadline, with what each blocks' })
  async list(@Actor() actor: MemberActor, @Query() query: DecisionsQueryDto) {
    const statuses = query.status ?? ['open'];
    const page = await this.query.listWithDetail(actor, 'decision', {
      statuses,
      roles: query.mine ? actor.roles : query.deciderRole,
      flags: query.overdue ? ['overdue'] : undefined,
      sort: statuses.includes('open') ? 'due' : 'lastEvent',
      cursor: query.cursor,
      limit: query.limit,
    });
    const blocks = await this.query.blocksOf(
      actor,
      page.items.map((card) => card.id),
    );
    return { ...page, items: page.items.map((card) => ({ ...card, blocks: blocks.get(card.id) ?? [] })) };
  }

  @Patch(':key/options')
  @Permissions('decision.edit_options')
  @ApiOperation({ summary: 'Replace the options of an open decision' })
  @ApiOkResponse({ type: CardWrittenResponseDto })
  options(@Actor() actor: MemberActor, @Param('key') key: string, @Body() body: OptionsDto) {
    return this.run(actor, key, 'decision.edit_options', body);
  }

  @Post(':key/decide')
  @HttpCode(200)
  @Permissions('decision.decide')
  @ApiOperation({ summary: 'Decide, with a rationale' })
  @ApiOkResponse({ type: CardWrittenResponseDto })
  decide(@Actor() actor: MemberActor, @Param('key') key: string, @Body() body: DecideDto) {
    return this.run(actor, key, 'decision.decide', body);
  }

  @Post(':key/withdraw')
  @HttpCode(200)
  @Permissions('decision.withdraw')
  @ApiOperation({ summary: 'Withdraw an open decision' })
  @ApiOkResponse({ type: CardWrittenResponseDto })
  withdraw(@Actor() actor: MemberActor, @Param('key') key: string, @Body() body: ReasonDto) {
    return this.run(actor, key, 'decision.withdraw', body);
  }

  @Post(':key/supersede')
  @HttpCode(200)
  @Permissions('decision.supersede')
  @ApiOperation({ summary: 'Replace a decision by another' })
  @ApiOkResponse({ type: CardWrittenResponseDto })
  supersede(@Actor() actor: MemberActor, @Param('key') key: string, @Body() body: SupersedeDto) {
    return this.run(actor, key, 'decision.supersede', body);
  }

  @Put(':key/adr')
  @Permissions('decision.draft_adr')
  @ApiOperation({ summary: 'Save the ADR draft' })
  @ApiOkResponse({ type: CardWrittenResponseDto })
  adr(@Actor() actor: MemberActor, @Param('key') key: string, @Body() body: DraftAdrDto) {
    return this.run(actor, key, 'decision.draft_adr', body);
  }
}
