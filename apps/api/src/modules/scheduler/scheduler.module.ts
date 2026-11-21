/**
 * @file The deadline engine (H3-05), in-app only.
 */
import { Module } from '@nestjs/common';

import { CardsModule } from '@/modules/cards';
import { WorkspacesModule } from '@/modules/workspaces';

import { SchedulerProcessor } from './application/scheduler.processor';
import { SchedulerService } from './application/scheduler.service';
import { CardRemindAction, DecisionEscalateAction } from './application/scheduler-actions';

@Module({
  imports: [CardsModule, WorkspacesModule],
  providers: [SchedulerService, SchedulerProcessor, CardRemindAction, DecisionEscalateAction],
  exports: [SchedulerService],
})
export class SchedulerModule {}
