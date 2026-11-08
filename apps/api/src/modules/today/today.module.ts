/**
 * @file The Today page and the sidebar counters (H1-06, H4-01).
 */
import { Module } from '@nestjs/common';

import { CardsModule } from '@/modules/cards';
import { DigestsModule } from '@/modules/digests';
import { NotificationsModule } from '@/modules/notifications';
import { WorkspacesModule } from '@/modules/workspaces';

import { CountersService } from './application/counters.service';
import { NextService } from './application/next.service';
import { SeenStore } from './application/seen.store';
import { SourceHealthService } from './application/source-health.service';
import { TeamService } from './application/team.service';
import { TodayService } from './application/today.service';
import { TodayController } from './presentation/http/today.controller';

@Module({
  imports: [CardsModule, DigestsModule, NotificationsModule, WorkspacesModule],
  controllers: [TodayController],
  providers: [CountersService, NextService, SeenStore, SourceHealthService, TeamService, TodayService],
  exports: [CountersService, NextService, SeenStore, SourceHealthService, TodayService],
})
export class TodayModule {}
