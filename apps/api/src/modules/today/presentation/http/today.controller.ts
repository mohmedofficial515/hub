/**
 * @file Today and the sidebar's counters (docs/04 §3.23).
 */
import {
  countersSchema,
  doNextListSchema,
  doNextQuerySchema,
  type MemberActor,
  todaySchema,
} from '@hub/contracts';
import { Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';

import { Actor, Permissions } from '@/shared/http';

import { CountersService } from '../../application/counters.service';
import { NextService } from '../../application/next.service';
import { TodayService } from '../../application/today.service';

class TodayDto extends createZodDto(todaySchema) {}
class CountersDto extends createZodDto(countersSchema) {}
class DoNextListDto extends createZodDto(doNextListSchema) {}
class DoNextQueryDto extends createZodDto(doNextQuerySchema) {}

@ApiTags('today')
@Controller('workspaces/:ws')
export class TodayController {
  constructor(
    private readonly today: TodayService,
    private readonly counters: CountersService,
    private readonly nextUp: NextService,
  ) {}

  @Get('today')
  @Permissions('card.read')
  @ApiOperation({ summary: 'Everything the Today page shows. Reading it clears nothing.' })
  @ApiOkResponse({ type: TodayDto })
  get(@Actor() actor: MemberActor) {
    return this.today.get(actor);
  }

  @Get('today/next')
  @Permissions('card.read')
  @ApiOperation({
    summary:
      'Do next: what to start, ranked from real state with no AI (overdue, blocking others, ready and small, plan steps next in line), each with its reasons',
  })
  @ApiOkResponse({ type: DoNextListDto })
  next(@Actor() actor: MemberActor, @Query() query: DoNextQueryDto): Promise<DoNextListDto> {
    return this.nextUp.next(actor, query);
  }

  @Post('today/seen')
  @HttpCode(204)
  @Permissions('card.read')
  @ApiOperation({ summary: 'The member looked: clears "since last visit" (`counters.newEvents`)' })
  @ApiNoContentResponse()
  seen(@Actor() actor: MemberActor) {
    return this.today.markSeen(actor);
  }

  @Get('counters')
  @Permissions('card.read')
  @ApiOperation({ summary: 'Every sidebar badge, derived from state on this read' })
  @ApiOkResponse({ type: CountersDto })
  getCounters(@Actor() actor: MemberActor) {
    return this.counters.get(actor);
  }
}
