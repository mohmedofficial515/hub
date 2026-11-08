/**
 * @file Schema Studio's routes (docs/17 §3). Reading is open to every member and their Claude; naming, drafting and refreshing have tools. Setting the source, starting a draft, sending it to review and
 * linking its chat are the page's own presses: the review's chat is started by the owner, never by an agent.
 */
import {
  attachDraftChatSchema,
  createSchemaDraftSchema,
  type MemberActor,
  putAnnotationsSchema,
  refreshSchemaResultSchema,
  refreshSchemaSchema,
  reviewDraftResultSchema,
  schemaDraftSchema,
  schemaSnapshotRowSchema,
  schemaSourceInputSchema,
  schemaStudioSchema,
  updateSchemaDraftSchema,
} from '@hub/contracts';
import { Body, Controller, Get, HttpCode, Param, Patch, Post, Put } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { SessionOnly } from '@/modules/identity';
import { Actor, Permissions } from '@/shared/http';

import { SchemaStudioService } from '../../application/schema-studio.service';

class SchemaStudioDto extends createZodDto(schemaStudioSchema) {}
class SchemaSourceInputDto extends createZodDto(schemaSourceInputSchema) {}
class RefreshSchemaDto extends createZodDto(refreshSchemaSchema) {}
class RefreshSchemaResultDto extends createZodDto(refreshSchemaResultSchema) {}
class PutAnnotationsDto extends createZodDto(putAnnotationsSchema) {}
class SnapshotRowsDto extends createZodDto(z.object({ snapshots: z.array(schemaSnapshotRowSchema) })) {}
class AnnotationsResultDto extends createZodDto(schemaStudioSchema.pick({ annotations: true })) {}
class CreateDraftDto extends createZodDto(createSchemaDraftSchema) {}
class UpdateDraftDto extends createZodDto(updateSchemaDraftSchema) {}
class AttachChatDto extends createZodDto(attachDraftChatSchema) {}
class SchemaDraftDto extends createZodDto(schemaDraftSchema) {}
class ReviewDraftResultDto extends createZodDto(reviewDraftResultSchema) {}

@ApiTags('schema')
@Controller('workspaces/:ws/schema')
export class SchemaStudioController {
  constructor(private readonly studio: SchemaStudioService) {}

  @Get()
  @Permissions('schema.read')
  @ApiOperation({ summary: 'The design as last read, its Arabic names, and the drafts of changes' })
  @ApiOkResponse({ type: SchemaStudioDto })
  get(@Actor() actor: MemberActor): Promise<SchemaStudioDto> {
    return this.studio.studio(actor);
  }

  @Put('source')
  @Permissions('schema.manage')
  @SessionOnly()
  @ApiOperation({
    summary:
      'Where the Prisma files are: one of the project’s folders, and the schema folder inside it. Reads it at once',
  })
  @ApiOkResponse({ type: SchemaStudioDto })
  setSource(@Actor() actor: MemberActor, @Body() body: SchemaSourceInputDto): Promise<SchemaStudioDto> {
    return this.studio.setSource(actor, body);
  }

  @Post('refresh')
  @HttpCode(200)
  @Permissions('schema.manage')
  @ApiOperation({
    summary: 'Read the files again; a new snapshot when they changed. With a draft, the draft is applied',
  })
  @ApiOkResponse({ type: RefreshSchemaResultDto })
  refresh(@Actor() actor: MemberActor, @Body() body: RefreshSchemaDto): Promise<RefreshSchemaResultDto> {
    return this.studio.refresh(actor, body, 'manual');
  }

  @Get('snapshots')
  @Permissions('schema.read')
  @ApiOperation({ summary: 'The design’s history, newest first, each with what changed' })
  @ApiOkResponse({ type: SnapshotRowsDto })
  async snapshots(@Actor() actor: MemberActor): Promise<SnapshotRowsDto> {
    return { snapshots: await this.studio.snapshots(actor) };
  }

  @Put('annotations')
  @Permissions('schema.annotate')
  @ApiOperation({
    summary: 'Arabic names, descriptions, notes, tags and sensitivity; a field left out keeps its value',
  })
  @ApiOkResponse({ type: AnnotationsResultDto })
  async annotate(
    @Actor() actor: MemberActor,
    @Body() body: PutAnnotationsDto,
  ): Promise<AnnotationsResultDto> {
    return { annotations: await this.studio.putAnnotations(actor, body.annotations) };
  }

  @Post('drafts')
  @Permissions('schema.draft')
  @SessionOnly()
  @ApiOperation({ summary: 'Start a draft of changes' })
  @ApiCreatedResponse({ type: SchemaDraftDto })
  createDraft(@Actor() actor: MemberActor, @Body() body: CreateDraftDto): Promise<SchemaDraftDto> {
    return this.studio.createDraft(actor, body);
  }

  @Get('drafts/:id')
  @Permissions('schema.read')
  @ApiOperation({ summary: 'One draft' })
  @ApiOkResponse({ type: SchemaDraftDto })
  draft(@Actor() actor: MemberActor, @Param('id') id: string): Promise<SchemaDraftDto> {
    return this.studio.draft(actor, id);
  }

  @Patch('drafts/:id')
  @Permissions('schema.draft')
  @ApiOperation({ summary: 'Change a draft: its title, changes, review or status' })
  @ApiOkResponse({ type: SchemaDraftDto })
  updateDraft(
    @Actor() actor: MemberActor,
    @Param('id') id: string,
    @Body() body: UpdateDraftDto,
  ): Promise<SchemaDraftDto> {
    return this.studio.updateDraft(actor, id, body);
  }

  @Post('drafts/:id/review')
  @HttpCode(200)
  @Permissions('schema.draft')
  @SessionOnly()
  @ApiOperation({
    summary:
      'Send a draft to review: it moves to In review, and the answer is the prompt the page sends to the panel',
  })
  @ApiOkResponse({ type: ReviewDraftResultDto })
  review(@Actor() actor: MemberActor, @Param('id') id: string): Promise<ReviewDraftResultDto> {
    return this.studio.review(actor, id);
  }

  @Post('drafts/:id/chat')
  @HttpCode(200)
  @Permissions('schema.draft')
  @SessionOnly()
  @ApiOperation({ summary: 'The panel chat the review runs in' })
  @ApiOkResponse({ type: SchemaDraftDto })
  attachChat(
    @Actor() actor: MemberActor,
    @Param('id') id: string,
    @Body() body: AttachChatDto,
  ): Promise<SchemaDraftDto> {
    return this.studio.attachChat(actor, id, body.chatId);
  }
}
