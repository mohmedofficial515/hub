/**
 * @file Plans: a written approach that becomes work (D29).
 */
import { Module } from '@nestjs/common';

import { CardsModule } from '@/modules/cards';

import {
  PlanAbandonAction,
  PlanApproveAction,
  PlanCreateAction,
  PlanFinishAction,
  PlanRestoreRevisionAction,
  PlanStartAction,
  PlanSubmitReviewAction,
  PlanSyncStepAction,
  PlanToTasksAction,
  PlanUpdateAction,
} from './application/plan-actions';
import { PlanReadService } from './application/plan-read.service';
import { PlansController } from './presentation/http/plans.controller';

@Module({
  imports: [CardsModule],
  controllers: [PlansController],
  providers: [
    PlanReadService,
    PlanCreateAction,
    PlanUpdateAction,
    PlanRestoreRevisionAction,
    PlanSubmitReviewAction,
    PlanApproveAction,
    PlanStartAction,
    PlanFinishAction,
    PlanAbandonAction,
    PlanToTasksAction,
    PlanSyncStepAction,
  ],
  exports: [PlanReadService],
})
export class PlansModule {}
