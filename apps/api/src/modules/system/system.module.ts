/**
 * @file Runs local sources, and reports on the system (H2-05, H2-06, H2-07).
 */
import { Module } from '@nestjs/common';

import { DocsModule } from '@/modules/docs';
import { NotificationsModule } from '@/modules/notifications';
import { RealtimeModule } from '@/modules/realtime';
import { RedesignModule } from '@/modules/redesign';
import { WorkspacesModule } from '@/modules/workspaces';

import { SourceRunProcessor } from './application/source-run.processor';
import { SourceRunnerService } from './application/source-runner.service';
import { SystemService } from './application/system.service';
import { MetricsController, SystemController } from './presentation/http/system.controller';

@Module({
  imports: [DocsModule, NotificationsModule, RealtimeModule, RedesignModule, WorkspacesModule],
  controllers: [SystemController, MetricsController],
  providers: [SourceRunnerService, SourceRunProcessor, SystemService],
  exports: [SourceRunnerService, SystemService],
})
export class SystemModule {}
