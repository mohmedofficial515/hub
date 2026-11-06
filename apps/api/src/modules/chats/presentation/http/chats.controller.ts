/**
 * @file The chat panel's REST routes (docs/16 §7, §7.1). Streaming comes through the member's SSE stream as `chat.event` and `chat.changed`, and `GET chats/:id` is how a device catches up.
 * @description Creating, sending, retrying, branching, stopping and answering an approval are session only: no token and no agent reaches them, so a chat cannot start another chat or approve its own call. Reading and tidying also have MCP tools.
 */
import {
  answerApprovalSchema,
  branchChatSchema,
  chatDiffQuerySchema,
  chatDiffSchema,
  chatFullSchema,
  chatListQuerySchema,
  chatSchema,
  chatTurnStartedSchema,
  createChatSchema,
  engineQuerySchema,
  engineStatusSchema,
  type MemberActor,
  promptTemplateInputSchema,
  promptTemplateSchema,
  retryChatSchema,
  sendChatMessageSchema,
  updateChatSchema,
  workReportSchema,
} from '@hub/contracts';
import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Query } from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { SessionOnly } from '@/modules/identity';
import { Actor, Permissions } from '@/shared/http';

import { ChatsService } from '../../application/chats.service';
import { WorkReportsService } from '../../application/work-reports.service';

class CreateChatDto extends createZodDto(createChatSchema) {}
class UpdateChatDto extends createZodDto(updateChatSchema) {}
class SendChatMessageDto extends createZodDto(sendChatMessageSchema) {}
class RetryChatDto extends createZodDto(retryChatSchema) {}
class AnswerApprovalDto extends createZodDto(answerApprovalSchema) {}
class BranchChatDto extends createZodDto(branchChatSchema) {}
class ChatListQueryDto extends createZodDto(chatListQuerySchema) {}
class ChatDiffQueryDto extends createZodDto(chatDiffQuerySchema) {}
class EngineQueryDto extends createZodDto(engineQuerySchema) {}
class PromptTemplateInputDto extends createZodDto(promptTemplateInputSchema) {}
class ChatRowDto extends createZodDto(chatSchema) {}
class ChatFullDto extends createZodDto(chatFullSchema) {}
class ChatTurnStartedDto extends createZodDto(chatTurnStartedSchema) {}
class ChatDiffDto extends createZodDto(chatDiffSchema) {}
class EngineStatusDto extends createZodDto(engineStatusSchema) {}
class PromptTemplateDto extends createZodDto(promptTemplateSchema) {}
class WorkReportDto extends createZodDto(workReportSchema) {}
class ChatExportDto extends createZodDto(z.object({ fileName: z.string(), markdown: z.string() })) {}

@ApiTags('chats')
@Controller('workspaces/:ws/chats')
export class ChatsController {
  constructor(private readonly chats: ChatsService) {}

  @Get()
  @Permissions('chat.read')
  @ApiOperation({
    summary: 'This member’s chats on this project, pinned first. `deleted=true` lists deleted ones',
  })
  @ApiOkResponse({ type: [ChatRowDto] })
  list(@Actor() actor: MemberActor, @Query() query: ChatListQueryDto): Promise<ChatRowDto[]> {
    return this.chats.list(actor, {
      deleted: query.deleted === 'true',
      ...(query.limit ? { limit: query.limit } : {}),
    });
  }

  @Get('engine')
  @Permissions('chat.read')
  @ApiOperation({
    summary: 'Claude Code on one device: version, range, sign-in, and which selectors it supports',
  })
  @ApiOkResponse({ type: EngineStatusDto })
  engine(@Actor() actor: MemberActor, @Query() query: EngineQueryDto): Promise<EngineStatusDto> {
    return this.chats.engine(actor, query.device, query.fresh === 'true');
  }

  @Post()
  @Permissions('chat.run')
  @SessionOnly()
  @ApiOperation({ summary: 'A new chat on a device, in a folder registered on this project' })
  @ApiCreatedResponse({ type: ChatRowDto })
  create(@Actor() actor: MemberActor, @Body() body: CreateChatDto): Promise<ChatRowDto> {
    return this.chats.create(actor, body);
  }

  @Get(':id')
  @Permissions('chat.read')
  @ApiOperation({
    summary: 'One chat with every message, step and approval. This is also how a device catches up',
  })
  @ApiOkResponse({ type: ChatFullDto })
  get(@Actor() actor: MemberActor, @Param('id') id: string): Promise<ChatFullDto> {
    return this.chats.get(actor, id);
  }

  @Patch(':id')
  @Permissions('chat.manage')
  @ApiOperation({ summary: 'Rename or pin a chat, or set its mode, model and effort for the next turn' })
  @ApiOkResponse({ type: ChatRowDto })
  update(
    @Actor() actor: MemberActor,
    @Param('id') id: string,
    @Body() body: UpdateChatDto,
  ): Promise<ChatRowDto> {
    return this.chats.update(actor, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  @Permissions('chat.manage')
  @ApiOperation({ summary: 'Delete a chat. It can be restored (D28). A running turn stops first' })
  @ApiNoContentResponse()
  async remove(@Actor() actor: MemberActor, @Param('id') id: string): Promise<void> {
    await this.chats.remove(actor, id);
  }

  @Post(':id/restore')
  @HttpCode(200)
  @Permissions('chat.manage')
  @ApiOperation({ summary: 'Bring a deleted chat back' })
  @ApiOkResponse({ type: ChatRowDto })
  restore(@Actor() actor: MemberActor, @Param('id') id: string): Promise<ChatRowDto> {
    return this.chats.restore(actor, id);
  }

  @Post(':id/messages')
  @HttpCode(202)
  @Permissions('chat.run')
  @SessionOnly()
  @ApiOperation({ summary: 'Send a message. The reply streams; another send while it runs is refused' })
  @ApiOkResponse({ type: ChatTurnStartedDto })
  send(
    @Actor() actor: MemberActor,
    @Param('id') id: string,
    @Body() body: SendChatMessageDto,
  ): Promise<ChatTurnStartedDto> {
    return this.chats.send(actor, id, body);
  }

  @Post(':id/retry')
  @HttpCode(202)
  @Permissions('chat.run')
  @SessionOnly()
  @ApiOperation({ summary: 'Send the last message again as a new turn' })
  @ApiOkResponse({ type: ChatTurnStartedDto })
  retry(
    @Actor() actor: MemberActor,
    @Param('id') id: string,
    @Body() body: RetryChatDto,
  ): Promise<ChatTurnStartedDto> {
    return this.chats.retry(actor, id, body);
  }

  @Post(':id/stop')
  @HttpCode(204)
  @Permissions('chat.run')
  @SessionOnly()
  @ApiOperation({
    summary: 'Stop the running turn: the interrupt first, then the process tree if it does not end',
  })
  @ApiNoContentResponse()
  async stop(@Actor() actor: MemberActor, @Param('id') id: string): Promise<void> {
    await this.chats.stop(actor, id);
  }

  @Post(':id/branch')
  @Permissions('chat.run')
  @SessionOnly()
  @ApiOperation({ summary: 'A new chat holding the words up to a message' })
  @ApiCreatedResponse({ type: ChatRowDto })
  branch(
    @Actor() actor: MemberActor,
    @Param('id') id: string,
    @Body() body: BranchChatDto,
  ): Promise<ChatRowDto> {
    return this.chats.branch(actor, id, body.message, body.title);
  }

  @Post(':id/approvals/:approval')
  @HttpCode(204)
  @Permissions('chat.answer')
  @SessionOnly()
  @ApiOperation({
    summary:
      'Allow once or deny a paused call, or answer a question. The first answer wins; later ones get a conflict. An offline device refuses it',
  })
  @ApiNoContentResponse()
  async answer(
    @Actor() actor: MemberActor,
    @Param('id') id: string,
    @Param('approval') approval: string,
    @Body() body: AnswerApprovalDto,
  ): Promise<void> {
    await this.chats.answer(actor, id, approval, body);
  }

  @Get(':id/export')
  @Permissions('chat.read')
  @ApiOperation({ summary: 'The chat as Markdown' })
  @ApiOkResponse({ type: ChatExportDto })
  export(@Actor() actor: MemberActor, @Param('id') id: string): Promise<ChatExportDto> {
    return this.chats.exportMarkdown(actor, id);
  }

  @Get(':id/diff')
  @Permissions('chat.read')
  @ApiOperation({ summary: 'One file’s diff against HEAD as it is now on the device. Read only' })
  @ApiOkResponse({ type: ChatDiffDto })
  diff(
    @Actor() actor: MemberActor,
    @Param('id') id: string,
    @Query() query: ChatDiffQueryDto,
  ): Promise<ChatDiffDto> {
    return this.chats.diff(actor, id, query.path);
  }
}

@ApiTags('chats')
@Controller('workspaces/:ws/cards/:key/work-reports')
export class WorkReportsController {
  constructor(private readonly reports: WorkReportsService) {}

  @Get()
  @Permissions('card.read')
  @ApiOperation({
    summary:
      'A card’s work reports, newest first: each check with its real runs, what is verified and what is claimed',
  })
  @ApiOkResponse({ type: [WorkReportDto] })
  list(@Actor() actor: MemberActor, @Param('key') key: string): Promise<WorkReportDto[]> {
    return this.reports.reportsOn(actor, key);
  }
}

@ApiTags('chats')
@Controller('workspaces/:ws/prompt-templates')
export class PromptTemplatesController {
  constructor(private readonly chats: ChatsService) {}

  @Get()
  @Permissions('chat.read')
  @ApiOperation({ summary: 'Frequent prompts saved on this project' })
  @ApiOkResponse({ type: [PromptTemplateDto] })
  list(@Actor() actor: MemberActor): Promise<PromptTemplateDto[]> {
    return this.chats.templates(actor);
  }

  @Post()
  @Permissions('chat.manage')
  @ApiOperation({ summary: 'Save a frequent prompt' })
  @ApiCreatedResponse({ type: PromptTemplateDto })
  create(@Actor() actor: MemberActor, @Body() body: PromptTemplateInputDto): Promise<PromptTemplateDto> {
    return this.chats.saveTemplate(actor, body);
  }

  @Put(':id')
  @Permissions('chat.manage')
  @ApiOperation({ summary: 'Change a saved prompt' })
  @ApiOkResponse({ type: PromptTemplateDto })
  update(
    @Actor() actor: MemberActor,
    @Param('id') id: string,
    @Body() body: PromptTemplateInputDto,
  ): Promise<PromptTemplateDto> {
    return this.chats.saveTemplate(actor, body, id);
  }

  @Delete(':id')
  @HttpCode(204)
  @Permissions('chat.manage')
  @ApiOperation({ summary: 'Delete a saved prompt' })
  @ApiNoContentResponse()
  async remove(@Actor() actor: MemberActor, @Param('id') id: string): Promise<void> {
    await this.chats.removeTemplate(actor, id);
  }
}
