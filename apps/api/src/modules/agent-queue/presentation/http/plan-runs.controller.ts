/**
 * @file Claude's runs on a plan, for every member of the project, read only (owner, 2026-11-20). The owner's own runs and controls stay on the
 * queue's routes.
 */
import { type MemberActor, planRunSchema } from '@hub/contracts';
import { Controller, Get, Param } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { Actor, Permissions } from '@/shared/http';

import { PlanRunsService } from '../../application/plan-runs.service';

class PlanRunsDto extends createZodDto(z.array(planRunSchema)) {}

@ApiTags('plans')
@Controller('workspaces/:ws/plans')
export class PlanRunsController {
  constructor(private readonly runs: PlanRunsService) {}

  @Get(':key/runs')
  @Permissions('plan.read_runs')
  @ApiOperation({
    summary:
      "Claude's runs on a plan, from every member: step, state, times, who, and the stage reports. No prompt, folder, device, chat or command",
  })
  @ApiOkResponse({ type: PlanRunsDto })
  list(@Actor() actor: MemberActor, @Param('key') key: string) {
    return this.runs.runsOf(actor, key);
  }
}
