/**
 * @file The Skills page (docs/16 §11, D64 to D66). Reading is everyone's, as every chat loads these skills. Writing one, Move to Hub, a restore and Sync now are the owner's alone and
 * only from the web: a skill reaches every device and steers every later chat there, so no token and no agent can write one.
 */
import {
  createSkillSchema,
  type MemberActor,
  moveSkillSchema,
  pluginSyncResultSchema,
  restoreSkillRevisionSchema,
  skillDetailSchema,
  skillRevisionDetailSchema,
  skillRevisionSchema,
  skillsSchema,
  skillWrittenSchema,
  updateSkillSchema,
} from '@hub/contracts';
import { Body, Controller, Get, HttpCode, Param, Post, Put } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { PluginSyncService } from '@/modules/devices';
import { SessionOnly } from '@/modules/identity';
import { Actor, Permissions } from '@/shared/http';

import { SkillsService } from '../../application/skills.service';

class SkillsDto extends createZodDto(skillsSchema) {}
class SkillDetailDto extends createZodDto(skillDetailSchema) {}
class SkillWrittenDto extends createZodDto(skillWrittenSchema) {}
class CreateSkillDto extends createZodDto(createSkillSchema) {}
class UpdateSkillDto extends createZodDto(updateSkillSchema) {}
class MoveSkillDto extends createZodDto(moveSkillSchema) {}
class SkillRevisionsDto extends createZodDto(z.array(skillRevisionSchema)) {}
class SkillRevisionDetailDto extends createZodDto(skillRevisionDetailSchema) {}
class RestoreSkillRevisionDto extends createZodDto(restoreSkillRevisionSchema) {}
class PluginSyncResultDto extends createZodDto(pluginSyncResultSchema) {}

@ApiTags('skills')
@Controller('workspaces/:ws/skills')
export class SkillsController {
  constructor(
    private readonly skills: SkillsService,
    private readonly sync: PluginSyncService,
  ) {}

  @Get()
  @Permissions('skill.read')
  @ApiOperation({
    summary:
      "Hub's skills with the devices that have each one's current text, the owner's personal skills (owner only), and the plugin each device took",
  })
  @ApiOkResponse({ type: SkillsDto })
  list(@Actor() actor: MemberActor): Promise<SkillsDto> {
    return this.skills.list(actor);
  }

  @Get('hub/:name')
  @Permissions('skill.read')
  @ApiOperation({ summary: "One of Hub's skills, with its Markdown" })
  @ApiOkResponse({ type: SkillDetailDto })
  hub(@Actor() actor: MemberActor, @Param('name') name: string): Promise<SkillDetailDto> {
    return this.skills.get(actor, 'hub', name);
  }

  @Get('personal/:name')
  @Permissions('skill.manage')
  @SessionOnly()
  @ApiOperation({ summary: 'One personal skill, read only, with any secret-looking value masked' })
  @ApiOkResponse({ type: SkillDetailDto })
  personal(@Actor() actor: MemberActor, @Param('name') name: string): Promise<SkillDetailDto> {
    return this.skills.get(actor, 'personal', name);
  }

  @Post()
  @Permissions('skill.manage')
  @SessionOnly()
  @ApiOperation({ summary: 'A new Hub skill. Every device takes it on the next sync' })
  @ApiCreatedResponse({ type: SkillWrittenDto })
  create(@Actor() actor: MemberActor, @Body() body: CreateSkillDto): Promise<SkillWrittenDto> {
    return this.skills.create(actor, body);
  }

  @Put('hub/:name')
  @Permissions('skill.manage')
  @SessionOnly()
  @ApiOperation({
    summary:
      "Save a Hub skill's description and text. The earlier text is kept; a save over a newer text is refused",
  })
  @ApiOkResponse({ type: SkillWrittenDto })
  update(
    @Actor() actor: MemberActor,
    @Param('name') name: string,
    @Body() body: UpdateSkillDto,
  ): Promise<SkillWrittenDto> {
    return this.skills.update(actor, name, body);
  }

  @Post('move')
  @Permissions('skill.manage')
  @SessionOnly()
  @ApiOperation({
    summary:
      'Copy a personal skill into Hub, under its own name or `as`. The personal original is never changed',
  })
  @ApiCreatedResponse({ type: SkillWrittenDto })
  move(@Actor() actor: MemberActor, @Body() body: MoveSkillDto): Promise<SkillWrittenDto> {
    return this.skills.move(actor, body);
  }

  @Get('hub/:name/revisions')
  @Permissions('skill.read')
  @ApiOperation({ summary: "A Hub skill's earlier texts, newest first" })
  @ApiOkResponse({ type: SkillRevisionsDto })
  revisions(@Param('name') name: string): Promise<SkillRevisionsDto> {
    return this.skills.revisions(name);
  }

  @Get('hub/:name/revisions/:id')
  @Permissions('skill.read')
  @ApiOperation({ summary: 'One earlier text of a Hub skill' })
  @ApiOkResponse({ type: SkillRevisionDetailDto })
  revision(@Param('name') name: string, @Param('id') id: string): Promise<SkillRevisionDetailDto> {
    return this.skills.revision(name, id);
  }

  @Post('hub/:name/revisions/:id/restore')
  @HttpCode(200)
  @Permissions('skill.manage')
  @SessionOnly()
  @ApiOperation({ summary: 'Bring an earlier text back. What is there now is kept as a revision of its own' })
  @ApiOkResponse({ type: SkillWrittenDto })
  restore(
    @Actor() actor: MemberActor,
    @Param('name') name: string,
    @Param('id') id: string,
    @Body() body: RestoreSkillRevisionDto,
  ): Promise<SkillWrittenDto> {
    return this.skills.restore(actor, name, id, body.baseHash);
  }

  @Post('sync')
  @HttpCode(200)
  @Permissions('skill.manage')
  @SessionOnly()
  @ApiOperation({
    summary: 'Sync now: every online device takes the current plugin. Answers each device after it',
  })
  @ApiOkResponse({ type: PluginSyncResultDto })
  async syncNow(): Promise<PluginSyncResultDto> {
    return { devices: await this.sync.syncNow() };
  }
}
