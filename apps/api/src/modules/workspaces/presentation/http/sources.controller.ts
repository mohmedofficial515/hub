/**
 * @file Source routes (docs/04 §3.7). Run now and run history belong to the capture module (H2-05).
 */
import type { MemberActor } from '@hub/contracts';
import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { Actor, Permissions } from '@/shared/http';

import { SourcesService } from '../../application/sources.service';
import { CreateSourceDto, SourceDtoHttp, SourceTestResultDto, UpdateSourceDto } from './workspaces.dto';

@ApiTags('sources')
@Controller('workspaces/:ws/sources')
export class SourcesController {
  constructor(private readonly sources: SourcesService) {}

  @Get()
  @Permissions('source.read')
  @ApiOperation({ summary: 'The project’s sources. A secret shows only as `hasSecret`' })
  @ApiOkResponse({ type: [SourceDtoHttp] })
  list(@Actor() actor: MemberActor): Promise<SourceDtoHttp[]> {
    return this.sources.list(actor.workspaceId);
  }

  @Post()
  @HttpCode(201)
  @Permissions('source.manage')
  @ApiOperation({ summary: 'Add a source. A secret may be set from the web only' })
  @ApiCreatedResponse({ type: SourceDtoHttp })
  create(@Actor() actor: MemberActor, @Body() body: CreateSourceDto): Promise<SourceDtoHttp> {
    return this.sources.create(actor, body);
  }

  @Get(':id')
  @Permissions('source.read')
  @ApiOperation({ summary: 'One source' })
  @ApiOkResponse({ type: SourceDtoHttp })
  get(@Actor() actor: MemberActor, @Param('id') id: string): Promise<SourceDtoHttp> {
    return this.sources.get(actor.workspaceId, id);
  }

  @Patch(':id')
  @Permissions('source.manage')
  @ApiOperation({ summary: 'Change, enable or disable a source. Null clears its secret' })
  @ApiOkResponse({ type: SourceDtoHttp })
  update(
    @Actor() actor: MemberActor,
    @Param('id') id: string,
    @Body() body: UpdateSourceDto,
  ): Promise<SourceDtoHttp> {
    return this.sources.update(actor, id, body);
  }

  @Post(':id/test')
  @HttpCode(200)
  @Permissions('source.manage')
  @ApiOperation({ summary: 'Check that the source can be reached' })
  @ApiOkResponse({ type: SourceTestResultDto })
  test(@Actor() actor: MemberActor, @Param('id') id: string): Promise<SourceTestResultDto> {
    return this.sources.test(actor, id);
  }

  @Delete(':id')
  @HttpCode(204)
  @Permissions('source.manage')
  @ApiOperation({ summary: 'Delete a source. Its history stays' })
  @ApiNoContentResponse()
  async remove(@Actor() actor: MemberActor, @Param('id') id: string): Promise<void> {
    await this.sources.remove(actor, id);
  }
}
