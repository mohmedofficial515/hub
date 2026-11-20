/**
 * @file Asking for a plan's explainer video (v5-live-plan, batch 4). The film itself comes back through the MCP tool `attach_plan_explainer`, from
 * the Claude run that made it in Hams' folder.
 */
import { explainerRequestSchema, type MemberActor } from '@hub/contracts';
import { Body, Controller, HttpCode, Param, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';

import { CardQueryService, CardWrittenResponseDto } from '@/modules/cards';
import { Actor, Permissions } from '@/shared/http';

import { PlanExplainerService } from '../../application/plan-explainer.service';

class ExplainerRequestDto extends createZodDto(explainerRequestSchema) {}

@ApiTags('plans')
@Controller('workspaces/:ws/plans')
export class PlanExplainerController {
  constructor(
    private readonly explainer: PlanExplainerService,
    private readonly query: CardQueryService,
  ) {}

  @Post(':key/explainer')
  @HttpCode(200)
  @Permissions('plan.request_explainer')
  @ApiOperation({
    summary:
      "Ask for the plan's explainer video, made by Hams for the plan as it is now. The owner's agent queue makes it (source explainer). With the Google voice, the script's text goes to Google",
  })
  @ApiOkResponse({ type: CardWrittenResponseDto })
  async request(@Actor() actor: MemberActor, @Param('key') key: string, @Body() body: ExplainerRequestDto) {
    return this.query.written(actor, await this.explainer.request(actor, key, body));
  }
}
