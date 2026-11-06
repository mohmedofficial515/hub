/**
 * @file Chats (docs/16 §7): the engine behind the panel. The bridge runs Claude Code; this keeps Hub's copy and carries it to the browser.
 */
import { Module } from '@nestjs/common';

import { AuditModule } from '@/modules/audit';
import { CardsModule } from '@/modules/cards';
import { DevicesModule } from '@/modules/devices';
import { DocsModule } from '@/modules/docs';
import { WorkspacesModule } from '@/modules/workspaces';

import { ChatsService } from './application/chats.service';
import { DocDraftsService } from './application/doc-drafts.service';
import { TurnRegistry } from './application/turn-registry';
import { WorkReportsService } from './application/work-reports.service';
import {
  ChatsController,
  PromptTemplatesController,
  WorkReportsController,
} from './presentation/http/chats.controller';

@Module({
  imports: [AuditModule, CardsModule, DevicesModule, DocsModule, WorkspacesModule],
  controllers: [ChatsController, PromptTemplatesController, WorkReportsController],
  providers: [ChatsService, TurnRegistry, WorkReportsService, DocDraftsService],
  exports: [ChatsService, WorkReportsService, DocDraftsService],
})
export class ChatsModule {}
