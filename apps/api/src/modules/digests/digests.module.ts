/**
 * @file Briefs, the weekly summary and the timeline summary (docs/07 §6).
 */
import { Module } from '@nestjs/common';

import { CardsModule } from '@/modules/cards';
import { NotificationsModule } from '@/modules/notifications';
import { WorkspacesModule } from '@/modules/workspaces';

import { BriefBuilder } from './application/brief.builder';
import { BriefsService } from './application/briefs.service';
import { DigestsProcessor } from './application/digests.processor';
import { MemberWorkService } from './application/member-work.service';
import { TimelineSummaryService } from './application/timeline-summary.service';
import { BriefsController } from './presentation/http/briefs.controller';

@Module({
  imports: [CardsModule, NotificationsModule, WorkspacesModule],
  controllers: [BriefsController],
  providers: [BriefBuilder, BriefsService, DigestsProcessor, MemberWorkService, TimelineSummaryService],
  exports: [BriefsService, MemberWorkService, TimelineSummaryService],
})
export class DigestsModule {}
