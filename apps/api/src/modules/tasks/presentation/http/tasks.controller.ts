/**
 * @file Task routes (docs/04 §3.10).
 */
import {
  type CardWrittenDto,
  claimTaskSchema,
  completeTaskSchema,
  editTaskDetailSchema,
  type MemberActor,
  optionalReasonSchema,
  type PermissionAction,
  reasonSchema,
  specialtySchema,
  submitTaskSchema,
} from '@hub/contracts';
import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { CardQueryService, CardService, CardWrittenResponseDto } from '@/modules/cards';
import { Actor, Permissions } from '@/shared/http';

import { TasksReadService } from '../../application/tasks-read.service';

class ReadyQueryDto extends createZodDto(
  z.object({
    specialty: specialtySchema.optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  }),
) {}
class ClaimDto extends createZodDto(claimTaskSchema) {}
class SubmitDto extends createZodDto(submitTaskSchema) {}
class CompleteDto extends createZodDto(completeTaskSchema) {}
class ReasonDto extends createZodDto(reasonSchema) {}
class OptionalReasonDto extends createZodDto(optionalReasonSchema) {}
class EditDetailDto extends createZodDto(editTaskDetailSchema) {}
class TaskPromptDto extends createZodDto(z.object({ markdown: z.string() })) {}

@ApiTags('tasks')
@Controller('workspaces/:ws/tasks')
export class TasksController {
  constructor(
    private readonly cards: CardService,
    private readonly query: CardQueryService,
    private readonly tasks: TasksReadService,
  ) {}

  private async run(
    actor: MemberActor,
    key: string,
    action: PermissionAction,
    payload: unknown,
  ): Promise<CardWrittenDto> {
    return this.query.written(actor, await this.cards.apply(actor, { cardKey: key }, action, payload));
  }

  @Get('ready')
  @Permissions('card.read')
  @ApiOperation({ summary: 'Ready, unblocked tasks for my specialties' })
  ready(@Actor() actor: MemberActor, @Query() query: ReadyQueryDto) {
    return this.tasks.ready(actor, query.specialty, query.limit);
  }

  @Get('mine')
  @Permissions('card.read')
  @ApiOperation({ summary: 'My claimed tasks' })
  mine(@Actor() actor: MemberActor) {
    return this.tasks.mine(actor);
  }

  @Get(':key/prompt')
  @Permissions('card.read')
  @ApiOperation({ summary: 'The ready-to-paste prompt of a task' })
  @ApiOkResponse({ type: TaskPromptDto })
  prompt(@Actor() actor: MemberActor, @Param('key') key: string) {
    return this.tasks.prompt(actor, key);
  }

  @Patch(':key')
  @Permissions('task.edit_detail')
  @ApiOperation({ summary: 'Edit specialty, effort, acceptance, prompt, branch or PR' })
  @ApiOkResponse({ type: CardWrittenResponseDto })
  edit(@Actor() actor: MemberActor, @Param('key') key: string, @Body() body: EditDetailDto) {
    return this.run(actor, key, 'task.edit_detail', body);
  }

  @Post(':key/claim')
  @HttpCode(200)
  @Permissions('task.claim')
  @ApiOperation({ summary: 'Claim a task' })
  @ApiOkResponse({ type: CardWrittenResponseDto })
  claim(@Actor() actor: MemberActor, @Param('key') key: string, @Body() body: ClaimDto) {
    return this.run(actor, key, 'task.claim', body);
  }

  @Post(':key/unclaim')
  @HttpCode(200)
  @Permissions('task.unclaim')
  @ApiOperation({ summary: 'Give a claimed task back' })
  @ApiOkResponse({ type: CardWrittenResponseDto })
  unclaim(@Actor() actor: MemberActor, @Param('key') key: string) {
    return this.run(actor, key, 'task.unclaim', {});
  }

  @Post(':key/start')
  @HttpCode(200)
  @Permissions('task.start')
  @ApiOperation({ summary: 'Start a claimed task' })
  @ApiOkResponse({ type: CardWrittenResponseDto })
  start(@Actor() actor: MemberActor, @Param('key') key: string) {
    return this.run(actor, key, 'task.start', {});
  }

  @Post(':key/submit-review')
  @HttpCode(200)
  @Permissions('task.submit_review')
  @ApiOperation({ summary: 'Send a task to review' })
  @ApiOkResponse({ type: CardWrittenResponseDto })
  submit(@Actor() actor: MemberActor, @Param('key') key: string, @Body() body: SubmitDto) {
    return this.run(actor, key, 'task.submit_review', body);
  }

  @Post(':key/resume')
  @HttpCode(200)
  @Permissions('task.resume')
  @ApiOperation({ summary: 'Back from review to in progress' })
  @ApiOkResponse({ type: CardWrittenResponseDto })
  resume(@Actor() actor: MemberActor, @Param('key') key: string, @Body() body: OptionalReasonDto) {
    return this.run(actor, key, 'task.resume', body);
  }

  @Post(':key/done')
  @HttpCode(200)
  // `task.complete` or `task.review` by the card's status: `apply` decides.
  @Permissions('card.read')
  @ApiOperation({ summary: 'Complete a task' })
  @ApiOkResponse({ type: CardWrittenResponseDto })
  done(@Actor() actor: MemberActor, @Param('key') key: string, @Body() body: CompleteDto) {
    return this.run(actor, key, 'task.complete', body);
  }

  @Post(':key/cancel')
  @HttpCode(200)
  @Permissions('task.cancel')
  @ApiOperation({ summary: 'Cancel a task, with a reason' })
  @ApiOkResponse({ type: CardWrittenResponseDto })
  cancel(@Actor() actor: MemberActor, @Param('key') key: string, @Body() body: ReasonDto) {
    return this.run(actor, key, 'task.cancel', body);
  }

  @Post(':key/reopen')
  @HttpCode(200)
  @Permissions('task.reopen')
  @ApiOperation({ summary: 'Reopen a finished task' })
  @ApiOkResponse({ type: CardWrittenResponseDto })
  reopen(@Actor() actor: MemberActor, @Param('key') key: string, @Body() body: OptionalReasonDto) {
    return this.run(actor, key, 'task.reopen', body);
  }

  @Post(':key/mark-ready')
  @HttpCode(200)
  @Permissions('task.mark_ready')
  @ApiOperation({ summary: 'From backlog to ready' })
  @ApiOkResponse({ type: CardWrittenResponseDto })
  markReady(@Actor() actor: MemberActor, @Param('key') key: string) {
    return this.run(actor, key, 'task.mark_ready', {});
  }

  @Post(':key/mark-backlog')
  @HttpCode(200)
  @Permissions('task.mark_backlog')
  @ApiOperation({ summary: 'From ready to backlog' })
  @ApiOkResponse({ type: CardWrittenResponseDto })
  markBacklog(@Actor() actor: MemberActor, @Param('key') key: string) {
    return this.run(actor, key, 'task.mark_backlog', {});
  }
}
