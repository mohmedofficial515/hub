/**
 * @file Idea routes (docs/15 §4).
 */
import {
  IDEA_STATUSES,
  ideaToPlanSchema,
  type MemberActor,
  optionalReasonSchema,
  type PermissionAction,
  queryList,
  updateIdeaSchema,
} from '@hub/contracts';
import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, UseInterceptors } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import {
  CardQueryService,
  CardService,
  CardWrittenResponseDto,
  IdempotencyInterceptor,
} from '@/modules/cards';
import { Actor, Permissions } from '@/shared/http';

class IdeasQueryDto extends createZodDto(
  z.object({
    status: queryList(z.enum(IDEA_STATUSES)),
    q: z.string().trim().min(1).max(200).optional(),
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  }),
) {}
class UpdateDto extends createZodDto(updateIdeaSchema) {}
class ToPlanDto extends createZodDto(ideaToPlanSchema) {}
class OptionalReasonDto extends createZodDto(optionalReasonSchema) {}

@ApiTags('ideas')
@Controller('workspaces/:ws/ideas')
export class IdeasController {
  constructor(
    private readonly cards: CardService,
    private readonly query: CardQueryService,
  ) {}

  private async run(actor: MemberActor, key: string, action: PermissionAction, payload: unknown) {
    return this.query.written(actor, await this.cards.apply(actor, { cardKey: key }, action, payload));
  }

  @Get()
  @Permissions('card.read')
  @ApiOperation({ summary: 'Ideas' })
  list(@Actor() actor: MemberActor, @Query() query: IdeasQueryDto) {
    return this.query.listWithDetail(actor, 'idea', {
      statuses: query.status,
      q: query.q,
      cursor: query.cursor,
      limit: query.limit,
    });
  }

  @Patch(':key')
  @Permissions('idea.update')
  @ApiOperation({ summary: 'Edit an idea' })
  @ApiOkResponse({ type: CardWrittenResponseDto })
  update(@Actor() actor: MemberActor, @Param('key') key: string, @Body() body: UpdateDto) {
    return this.run(actor, key, 'idea.update', body);
  }

  @Post(':key/explore')
  @HttpCode(200)
  @Permissions('idea.explore')
  @ApiOperation({ summary: 'Start exploring an idea' })
  @ApiOkResponse({ type: CardWrittenResponseDto })
  explore(@Actor() actor: MemberActor, @Param('key') key: string) {
    return this.run(actor, key, 'idea.explore', {});
  }

  @Post(':key/accept')
  @HttpCode(200)
  @Permissions('idea.accept')
  @ApiOperation({ summary: 'Accept an idea with no plan' })
  @ApiOkResponse({ type: CardWrittenResponseDto })
  accept(@Actor() actor: MemberActor, @Param('key') key: string) {
    return this.run(actor, key, 'idea.accept', {});
  }

  @Post(':key/park')
  @HttpCode(200)
  @Permissions('idea.park')
  @ApiOperation({ summary: 'Park an idea' })
  @ApiOkResponse({ type: CardWrittenResponseDto })
  park(@Actor() actor: MemberActor, @Param('key') key: string, @Body() body: OptionalReasonDto) {
    return this.run(actor, key, 'idea.park', body);
  }

  @Post(':key/reject')
  @HttpCode(200)
  @Permissions('idea.reject')
  @ApiOperation({ summary: 'Reject an idea' })
  @ApiOkResponse({ type: CardWrittenResponseDto })
  reject(@Actor() actor: MemberActor, @Param('key') key: string, @Body() body: OptionalReasonDto) {
    return this.run(actor, key, 'idea.reject', body);
  }

  @Post(':key/reopen')
  @HttpCode(200)
  @Permissions('idea.reopen')
  @ApiOperation({ summary: 'Reopen a parked or rejected idea' })
  @ApiOkResponse({ type: CardWrittenResponseDto })
  reopen(@Actor() actor: MemberActor, @Param('key') key: string) {
    return this.run(actor, key, 'idea.reopen', {});
  }

  @Post(':key/to-plan')
  @HttpCode(200)
  @Permissions('idea.to_plan')
  @UseInterceptors(IdempotencyInterceptor)
  @ApiOperation({ summary: 'Turn into a linked plan, accepting the idea' })
  @ApiOkResponse({ type: CardWrittenResponseDto })
  toPlan(@Actor() actor: MemberActor, @Param('key') key: string, @Body() body: ToPlanDto) {
    return this.run(actor, key, 'idea.to_plan', body);
  }
}
