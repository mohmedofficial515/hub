/**
 * @file Chats (docs/16 §7): the engine behind the panel. The bridge runs Claude Code; this keeps Hub's copy and carries it to the browser.
 */
import { Module } from '@nestjs/common';

import { AuditModule } from '@/modules/audit';
import { DevicesModule } from '@/modules/devices';
import { WorkspacesModule } from '@/modules/workspaces';

import { ChatsService } from './application/chats.service';
import { ChatsController, PromptTemplatesController } from './presentation/http/chats.controller';

@Module({
  imports: [AuditModule, DevicesModule, WorkspacesModule],
  controllers: [ChatsController, PromptTemplatesController],
  providers: [ChatsService],
  exports: [ChatsService],
})
export class ChatsModule {}
