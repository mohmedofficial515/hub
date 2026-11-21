/**
 * @file Brief routes (docs/04 §3.19) and `GET /timeline/summary` (§3.9).
 */
import {
  BRIEF_KINDS,
  briefSchema,
  briefsQuerySchema,
  type MemberActor,
  saveNarrativeSchema,
  timelineSummaryQuerySchema,
  timelineSummarySchema,
} from '@hub/contracts';
import { Body, Controller, Get, Param, Put, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { Actor, Permissions } from '@/shared/http';

import { BriefsService } from '../../application/briefs.service';
import { TimelineSummaryService } from '../../application/timeline-summary.service';

class BriefDto extends createZodDto(briefSchema) {}
class BriefsQueryDto extends createZodDto(briefsQuerySchema) {}
class SaveNarrativeDto extends createZodDto(saveNarrativeSchema) {}
class SummaryQueryDto extends createZodDto(timelineSummaryQuerySchema) {}
class SummaryDto extends createZodDto(timelineSummarySchema) {}

const kindSchema = z.enum(BRIEF_KINDS);

@ApiTags('digests')
@Controller('workspaces/:ws')
export class BriefsController {
  constructor(
    private readonly briefs: BriefsService,
    private readonly summaries: TimelineSummaryService,
  ) {}

  @Get('briefs/today')
  @Permissions('card.read')
  @ApiOperation({ summary: 'My morning brief, computed for this read until the job stores it' })
  @ApiOkResponse({ type: BriefDto })
  today(@Actor() actor: MemberActor) {
    return this.briefs.today(actor);
  }

  @Get('briefs')
  @Permissions('card.read')
  @ApiOperation({ summary: 'My morning briefs and the weekly summaries, newest first' })
  @ApiOkResponse({ type: BriefDto, isArray: true })
  list(@Actor() actor: MemberActor, @Query() query: BriefsQueryDto) {
    return this.briefs.list(actor, query);
  }

  @Get('briefs/weekly/:isoWeek')
  @Permissions('card.read')
  @ApiOperation({ summary: 'A weekly summary, such as 2026-W45' })
  @ApiOkResponse({ type: BriefDto })
  weekly(@Actor() actor: MemberActor, @Param('isoWeek') isoWeek: string) {
    return this.briefs.weekly(actor, isoWeek);
  }

  @Put('briefs/:kind/:date/narrative')
  @Permissions('brief.save')
  @ApiOperation({ summary: "Save the agent's narrative. A weekly one is for owner and pm." })
  @ApiOkResponse({ type: BriefDto })
  narrative(
    @Actor() actor: MemberActor,
    @Param('kind') kind: string,
    @Param('date') date: string,
    @Body() body: SaveNarrativeDto,
  ) {
    return this.briefs.saveNarrative(actor, kindSchema.parse(kind), date, body);
  }

  @Get('timeline/summary')
  @Permissions('card.read')
  @ApiOperation({ summary: 'What happened in a day or an ISO week' })
  @ApiOkResponse({ type: SummaryDto })
  summary(@Actor() actor: MemberActor, @Query() query: SummaryQueryDto) {
    return this.summaries.summary(actor, query);
  }
}
