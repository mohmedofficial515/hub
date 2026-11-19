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
  PlanRequestChangesAction,
  PlanRestoreRevisionAction,
  PlanStartAction,
  PlanSubmitReviewAction,
  PlanSyncStepAction,
  PlanToTasksAction,
  PlanUpdateAction,
} from './application/plan-actions';
import { PlanReadService } from './application/plan-read.service';
import { StudioSourceCheck } from './application/studio-source.check';
import { PlansController } from './presentation/http/plans.controller';

@Module({
  imports: [CardsModule],
  controllers: [PlansController],
  providers: [
    PlanReadService,
    StudioSourceCheck,
    PlanCreateAction,
    PlanUpdateAction,
    PlanRestoreRevisionAction,
    PlanSubmitReviewAction,
    PlanApproveAction,
    PlanRequestChangesAction,
    PlanStartAction,
    PlanFinishAction,
    PlanAbandonAction,
    PlanToTasksAction,
    PlanSyncStepAction,
  ],
  exports: [PlanReadService, StudioSourceCheck],
})
export class PlansModule {}
