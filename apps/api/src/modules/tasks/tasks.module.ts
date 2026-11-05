/**
 * @file Tasks: claim to done, the ready list and the rendered prompt.
 */
import { Module } from '@nestjs/common';

import { CardsModule } from '@/modules/cards';

import {
  TaskCancelAction,
  TaskClaimAction,
  TaskCloseAsPortedAction,
  TaskCompleteAction,
  TaskEditDetailAction,
  TaskMarkBacklogAction,
  TaskMarkReadyAction,
  TaskReopenAction,
  TaskResumeAction,
  TaskStartAction,
  TaskSubmitReviewAction,
  TaskUnclaimAction,
} from './application/task-actions';
import { TaskCreateAction } from './application/task-create.action';
import { TasksReadService } from './application/tasks-read.service';
import { TasksController } from './presentation/http/tasks.controller';

@Module({
  imports: [CardsModule],
  controllers: [TasksController],
  providers: [
    TasksReadService,
    TaskCreateAction,
    TaskClaimAction,
    TaskUnclaimAction,
    TaskStartAction,
    TaskSubmitReviewAction,
    TaskResumeAction,
    TaskCompleteAction,
    TaskCancelAction,
    TaskReopenAction,
    TaskMarkReadyAction,
    TaskMarkBacklogAction,
    TaskCloseAsPortedAction,
    TaskEditDetailAction,
  ],
})
export class TasksModule {}
