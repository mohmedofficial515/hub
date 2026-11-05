/**
 * @file The project's timeline (docs/04 §3.9).
 */
import type { MemberActor } from '@hub/contracts';
import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { Actor, Permissions } from '@/shared/http';

import { CardQueryService } from '../../application/card-query.service';
import { TimelineQueryDto, TimelineRowDto } from './card.dto';

@ApiTags('timeline')
@Controller('workspaces/:ws/timeline')
export class TimelineController {
  constructor(private readonly query: CardQueryService) {}

  @Get()
  @Permissions('card.read')
  @ApiOperation({ summary: 'What happened, newest first, with the collapse hint' })
  @ApiOkResponse({ type: TimelineRowDto, isArray: true })
  list(@Actor() actor: MemberActor, @Query() query: TimelineQueryDto) {
    return this.query.timeline(actor, query);
  }
}
