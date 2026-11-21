/**
 * @file The agent queue's routes (docs/16 §9). Reading is open to the member and to their Claude through `list_queue`; every change is session only, so an agent cannot start agents or lift its own limits.
 */
import {
  agentRunSchema,
  chatTurnStartedSchema,
  createRunSchema,
  type MemberActor,
  queuePauseSchema,
  queueRunsQuerySchema,
  queueSchema,
  queueSettingsInputSchema,
  queueStateSchema,
  reorderRunsSchema,
  setRunModeSchema,
} from '@hub/contracts';
import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';

import { SessionOnly } from '@/modules/identity';
import { Actor, Permissions } from '@/shared/http';

import { AgentQueueService } from '../../application/queue.service';

class CreateRunDto extends createZodDto(createRunSchema) {}
class ReorderRunsDto extends createZodDto(reorderRunsSchema) {}
class QueuePauseDto extends createZodDto(queuePauseSchema) {}
class QueueSettingsDto extends createZodDto(queueSettingsInputSchema) {}
class QueueRunsQueryDto extends createZodDto(queueRunsQuerySchema) {}
class AgentRunDto extends createZodDto(agentRunSchema) {}
class QueueDto extends createZodDto(queueSchema) {}
class QueueStateDto extends createZodDto(queueStateSchema) {}
class SetRunModeDto extends createZodDto(setRunModeSchema) {}
class ChatTurnStartedDto extends createZodDto(chatTurnStartedSchema) {}

@ApiTags('queue')
@Controller('workspaces/:ws/queue')
export class AgentQueueController {
  constructor(private readonly queue: AgentQueueService) {}

  @Get()
  @Permissions('queue.read')
  @ApiOperation({
    summary:
      'This project’s runs, not finished and the last finished, with the member’s limits and why a due run waits. `card` narrows to one card',
  })
  @ApiOkResponse({ type: QueueDto })
  list(@Actor() actor: MemberActor, @Query() query: QueueRunsQueryDto): Promise<QueueDto> {
    return this.queue.queue(actor, query.card ? { card: query.card } : {});
  }

  @Post('runs')
  @Permissions('queue.manage')
  @SessionOnly()
  @ApiOperation({
    summary: 'Run now, at a local time, or every week: a task, a plan step or a prompt, in a linked folder',
  })
  @ApiCreatedResponse({ type: AgentRunDto })
  create(@Actor() actor: MemberActor, @Body() body: CreateRunDto): Promise<AgentRunDto> {
    return this.queue.create(actor, body);
  }

  @Post('runs/:id/pause')
  @HttpCode(200)
  @Permissions('queue.manage')
  @SessionOnly()
  @ApiOperation({ summary: 'Hold a run. A running one stops now and continues in its chat on Resume' })
  @ApiOkResponse({ type: AgentRunDto })
  pause(@Actor() actor: MemberActor, @Param('id') id: string): Promise<AgentRunDto> {
    return this.queue.pause(actor, id);
  }

  @Post('runs/:id/resume')
  @HttpCode(200)
  @Permissions('queue.manage')
  @SessionOnly()
  @ApiOperation({ summary: 'Put a paused run back in line' })
  @ApiOkResponse({ type: AgentRunDto })
  resume(@Actor() actor: MemberActor, @Param('id') id: string): Promise<AgentRunDto> {
    return this.queue.resume(actor, id);
  }

  @Post('runs/:id/cancel')
  @HttpCode(200)
  @Permissions('queue.manage')
  @SessionOnly()
  @ApiOperation({ summary: 'Cancel a run, stopping it if it runs. A weekly run repeats no more' })
  @ApiOkResponse({ type: AgentRunDto })
  cancel(@Actor() actor: MemberActor, @Param('id') id: string): Promise<AgentRunDto> {
    return this.queue.cancel(actor, id);
  }

  @Post('runs/:id/allow-dirty')
  @HttpCode(200)
  @Permissions('queue.manage')
  @SessionOnly()
  @ApiOperation({
    summary:
      'Let a run start in a folder that holds changes not committed (docs/16 §9.2). The owner press only; the run mixes them with its own',
  })
  @ApiOkResponse({ type: AgentRunDto })
  allowDirty(@Actor() actor: MemberActor, @Param('id') id: string): Promise<AgentRunDto> {
    return this.queue.allowDirty(actor, id);
  }

  @Post('runs/:id/worktree/remove')
  @HttpCode(200)
  @Permissions('queue.manage')
  @SessionOnly()
  @ApiOperation({
    summary:
      "Remove an ended run's own copy of its repository (docs/16 §9.2). Its branch stays; refused while the copy holds changes not committed",
  })
  @ApiOkResponse({ type: AgentRunDto })
  removeWorktree(@Actor() actor: MemberActor, @Param('id') id: string): Promise<AgentRunDto> {
    return this.queue.removeWorktree(actor, id);
  }

  @Post('runs/:id/mode')
  @HttpCode(200)
  @Permissions('queue.manage')
  @SessionOnly()
  @ApiOperation({
    summary:
      'With my approval or Automatic, for a run that has not started (D58). Automatic skips what needs approval and keeps it as a pending item',
  })
  @ApiOkResponse({ type: AgentRunDto })
  setMode(
    @Actor() actor: MemberActor,
    @Param('id') id: string,
    @Body() body: SetRunModeDto,
  ): Promise<AgentRunDto> {
    return this.queue.setMode(actor, id, body.mode);
  }

  @Post('runs/:id/pending/:decisionId/run')
  @HttpCode(200)
  @Permissions('queue.manage')
  @SessionOnly()
  @ApiOperation({
    summary:
      'Run a pending item of a finished automatic run: a new chat on its folder, where the command still asks for approval (D41, D58)',
  })
  @ApiOkResponse({ type: ChatTurnStartedDto })
  runPending(
    @Actor() actor: MemberActor,
    @Param('id') id: string,
    @Param('decisionId') decisionId: string,
  ): Promise<ChatTurnStartedDto> {
    return this.queue.runPending(actor, id, decisionId);
  }

  @Post('order')
  @HttpCode(200)
  @Permissions('queue.manage')
  @SessionOnly()
  @ApiOperation({ summary: 'The order of the runs that have not started, first to start first' })
  @ApiOkResponse({ type: QueueDto })
  reorder(@Actor() actor: MemberActor, @Body() body: ReorderRunsDto): Promise<QueueDto> {
    return this.queue.reorder(actor, body);
  }

  @Post('pause')
  @HttpCode(200)
  @Permissions('queue.manage')
  @SessionOnly()
  @ApiOperation({ summary: 'Pause all, or resume. Running runs finish; nothing new starts while paused' })
  @ApiOkResponse({ type: QueueStateDto })
  pauseAll(@Actor() actor: MemberActor, @Body() body: QueuePauseDto): Promise<QueueStateDto> {
    return this.queue.pauseAll(actor, body.paused);
  }

  @Patch('settings')
  @Permissions('queue.manage')
  @SessionOnly()
  @ApiOperation({
    summary: 'Runs at once, runs per day, quiet hours and the timezone. The member’s, across projects',
  })
  @ApiOkResponse({ type: QueueStateDto })
  settings(@Actor() actor: MemberActor, @Body() body: QueueSettingsDto): Promise<QueueStateDto> {
    return this.queue.updateSettings(actor, body);
  }
}
