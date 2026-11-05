/**
 * @file Inbox routes (docs/04 §3.17).
 */
import {
  inboxCountSchema,
  inboxItemSchema,
  inboxQuerySchema,
  type MemberActor,
  readAllSchema,
} from '@hub/contracts';
import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';

import { Actor, Permissions } from '@/shared/http';

import { InboxService } from '../../application/inbox.service';

class InboxQueryDto extends createZodDto(inboxQuerySchema) {}
class InboxItemDto extends createZodDto(inboxItemSchema) {}
class InboxCountDto extends createZodDto(inboxCountSchema) {}
class ReadAllDto extends createZodDto(readAllSchema) {}

@ApiTags('inbox')
@Controller('workspaces/:ws/inbox')
export class InboxController {
  constructor(private readonly inbox: InboxService) {}

  @Get()
  @Permissions('notification.read')
  @ApiOperation({ summary: 'What is addressed to me, newest first. `pagination.total` is the unread count.' })
  @ApiOkResponse({ type: InboxItemDto, isArray: true })
  list(@Actor() actor: MemberActor, @Query() query: InboxQueryDto) {
    return this.inbox.list(actor, query);
  }

  @Get('count')
  @Permissions('notification.read')
  @ApiOperation({ summary: 'Unread items, and the cards waiting on me by type' })
  @ApiOkResponse({ type: InboxCountDto })
  count(@Actor() actor: MemberActor) {
    return this.inbox.count(actor);
  }

  @Post('read-all')
  @HttpCode(204)
  @Permissions('notification.read')
  @ApiOperation({ summary: 'Mark everything read, up to a moment if given' })
  @ApiNoContentResponse()
  readAll(@Actor() actor: MemberActor, @Body() body: ReadAllDto) {
    return this.inbox.readAll(actor, body);
  }

  @Post(':id/read')
  @HttpCode(204)
  @Permissions('notification.read')
  @ApiOperation({ summary: 'Mark one item read' })
  @ApiNoContentResponse()
  read(@Actor() actor: MemberActor, @Param('id', ParseUUIDPipe) id: string) {
    return this.inbox.read(actor, id);
  }

  @Post(':id/unread')
  @HttpCode(204)
  @Permissions('notification.read')
  @ApiOperation({ summary: 'Mark one item unread, the Undo of read' })
  @ApiNoContentResponse()
  unread(@Actor() actor: MemberActor, @Param('id', ParseUUIDPipe) id: string) {
    return this.inbox.unread(actor, id);
  }

  @Post(':id/archive')
  @HttpCode(204)
  @Permissions('notification.read')
  @ApiOperation({ summary: 'Archive one item' })
  @ApiNoContentResponse()
  archive(@Actor() actor: MemberActor, @Param('id', ParseUUIDPipe) id: string) {
    return this.inbox.archive(actor, id);
  }

  @Post(':id/unarchive')
  @HttpCode(204)
  @Permissions('notification.read')
  @ApiOperation({ summary: 'Bring an archived item back, the Undo of archive' })
  @ApiNoContentResponse()
  unarchive(@Actor() actor: MemberActor, @Param('id', ParseUUIDPipe) id: string) {
    return this.inbox.unarchive(actor, id);
  }
}
