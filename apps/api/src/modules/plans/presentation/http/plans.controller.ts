/**
 * @file Plan routes (docs/15 §4).
 */
import {
  type MemberActor,
  optionalReasonSchema,
  type PermissionAction,
  PLAN_STATUSES,
  planRevisionSchema,
  planToTasksSchema,
  queryList,
  restorePlanRevisionSchema,
  updatePlanSchema,
} from '@hub/contracts';
import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { CardQueryService, CardService, CardWrittenResponseDto } from '@/modules/cards';
import { Actor, Permissions } from '@/shared/http';

import { PlanReadService } from '../../application/plan-read.service';

class PlansQueryDto extends createZodDto(
  z.object({
    status: queryList(z.enum(PLAN_STATUSES)),
    q: z.string().trim().min(1).max(200).optional(),
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  }),
) {}
class UpdateDto extends createZodDto(updatePlanSchema) {}
class RestoreDto extends createZodDto(restorePlanRevisionSchema) {}
class ToTasksDto extends createZodDto(planToTasksSchema) {}
class OptionalReasonDto extends createZodDto(optionalReasonSchema) {}
class PlanRevisionDto extends createZodDto(planRevisionSchema) {}

@ApiTags('plans')
@Controller('workspaces/:ws/plans')
export class PlansController {
  constructor(
    private readonly cards: CardService,
    private readonly query: CardQueryService,
    private readonly plans: PlanReadService,
  ) {}

  private async run(actor: MemberActor, key: string, action: PermissionAction, payload: unknown) {
    return this.query.written(actor, await this.cards.apply(actor, { cardKey: key }, action, payload));
  }

  @Get()
  @Permissions('card.read')
  @ApiOperation({ summary: 'Plans, with their steps' })
  list(@Actor() actor: MemberActor, @Query() query: PlansQueryDto) {
    return this.query.listWithDetail(actor, 'plan', {
      statuses: query.status,
      q: query.q,
      cursor: query.cursor,
      limit: query.limit,
    });
  }

  @Get(':key/revisions')
  @Permissions('card.read')
  @ApiOperation({ summary: 'Every saved text of a plan, newest first' })
  @ApiOkResponse({ type: PlanRevisionDto, isArray: true })
  revisions(@Actor() actor: MemberActor, @Param('key') key: string) {
    return this.plans.revisions(actor, key);
  }

  @Patch(':key')
  @Permissions('plan.update')
  @ApiOperation({ summary: 'Edit a plan: a new body adds a revision' })
  @ApiOkResponse({ type: CardWrittenResponseDto })
  update(@Actor() actor: MemberActor, @Param('key') key: string, @Body() body: UpdateDto) {
    return this.run(actor, key, 'plan.update', body);
  }

  @Post(':key/restore')
  @HttpCode(200)
  @Permissions('plan.update')
  @ApiOperation({ summary: 'Bring a past revision back, as a new revision' })
  @ApiOkResponse({ type: CardWrittenResponseDto })
  restore(@Actor() actor: MemberActor, @Param('key') key: string, @Body() body: RestoreDto) {
    return this.run(actor, key, 'plan.restore_revision', { restoreRevision: body.revision });
  }

  @Post(':key/submit-review')
  @HttpCode(200)
  @Permissions('plan.submit_review')
  @ApiOperation({ summary: 'Send a draft to review' })
  @ApiOkResponse({ type: CardWrittenResponseDto })
  submit(@Actor() actor: MemberActor, @Param('key') key: string) {
    return this.run(actor, key, 'plan.submit_review', {});
  }

  @Post(':key/approve')
  @HttpCode(200)
  @Permissions('plan.approve')
  @ApiOperation({ summary: 'Approve a plan' })
  @ApiOkResponse({ type: CardWrittenResponseDto })
  approve(@Actor() actor: MemberActor, @Param('key') key: string) {
    return this.run(actor, key, 'plan.approve', {});
  }

  @Post(':key/start')
  @HttpCode(200)
  @Permissions('plan.start')
  @ApiOperation({ summary: 'Start an approved plan' })
  @ApiOkResponse({ type: CardWrittenResponseDto })
  start(@Actor() actor: MemberActor, @Param('key') key: string) {
    return this.run(actor, key, 'plan.start', {});
  }

  @Post(':key/finish')
  @HttpCode(200)
  @Permissions('plan.finish')
  @ApiOperation({ summary: 'Mark a plan done' })
  @ApiOkResponse({ type: CardWrittenResponseDto })
  finish(@Actor() actor: MemberActor, @Param('key') key: string) {
    return this.run(actor, key, 'plan.finish', {});
  }

  @Post(':key/abandon')
  @HttpCode(200)
  @Permissions('plan.abandon')
  @ApiOperation({ summary: 'Abandon a plan' })
  @ApiOkResponse({ type: CardWrittenResponseDto })
  abandon(@Actor() actor: MemberActor, @Param('key') key: string, @Body() body: OptionalReasonDto) {
    return this.run(actor, key, 'plan.abandon', body);
  }

  @Post(':key/to-tasks')
  @HttpCode(200)
  @Permissions('plan.to_tasks')
  @ApiOperation({ summary: 'Create one task per step with none, moving the plan to in progress' })
  @ApiOkResponse({ type: CardWrittenResponseDto })
  toTasks(@Actor() actor: MemberActor, @Param('key') key: string, @Body() body: ToTasksDto) {
    return this.run(actor, key, 'plan.to_tasks', body);
  }
}
