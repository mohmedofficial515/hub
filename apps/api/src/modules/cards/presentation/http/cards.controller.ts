/**
 * @file Generic card routes (docs/04 §3.8). H0-05 adds the rest; this is the pattern for an endpoint:
 * declare the permission, take `@Actor()`, call `CardService.apply`, shape the result.
 */
import type { MemberActor, PermissionAction } from '@hub/contracts';
import { Body, Controller, HttpCode, Param, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { Actor, Permissions } from '@/shared/http';

import { CardService } from '../../application/card.service';
import type { ApplyResult } from '../../domain/card-action';
import { CardWrittenDto, CreateCardDto } from './card.dto';

export function toCardWritten({ card, event }: ApplyResult): CardWrittenDto {
  return {
    id: card.id,
    key: card.key,
    type: card.type,
    title: card.title,
    body: card.body,
    status: card.status,
    priority: card.priority,
    ownerRole: card.ownerRole,
    assigneeId: card.assigneeId,
    lastEventAt: card.lastEventAt.toISOString(),
    createdAt: card.createdAt.toISOString(),
    event: { id: event.id, seq: event.seq, kind: event.kind },
  };
}

@ApiTags('cards')
@Controller('workspaces/:ws/cards')
export class CardsController {
  constructor(private readonly cards: CardService) {}

  @Post()
  @HttpCode(201)
  // Any member reaches this route; `apply` checks the row of the card type in the body, such as release.create.
  @Permissions('card.read')
  @ApiOperation({ summary: 'Create a card' })
  @ApiCreatedResponse({ type: CardWrittenDto })
  async create(
    @Param('ws') _ws: string,
    @Actor() actor: MemberActor,
    @Body() body: CreateCardDto,
  ): Promise<CardWrittenDto> {
    const { type, ...payload } = body;
    const action = `${type}.create` as PermissionAction;
    return toCardWritten(await this.cards.apply(actor, null, action, payload));
  }
}
