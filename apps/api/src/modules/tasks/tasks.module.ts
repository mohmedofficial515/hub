/**
 * @file Task actions. H0-06 adds claim, unclaim, start, submit, complete, reopen, cancel and the task routes.
 */
import { Module } from '@nestjs/common';

import { CardsModule } from '@/modules/cards';

import { TaskCreateAction } from './application/task-create.action';

@Module({
  imports: [CardsModule],
  providers: [TaskCreateAction],
})
export class TasksModule {}
