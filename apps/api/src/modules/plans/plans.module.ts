/**
 * @file Plans: a written approach that becomes work (D29).
 */
import { Module } from '@nestjs/common';

import { CardsModule } from '@/modules/cards';

import {
  PlanAbandonAction,
  PlanAddEvidenceAction,
  PlanApproveAction,
  PlanCreateAction,
  PlanFinishAction,
  PlanRemoveEvidenceAction,
  PlanRemoveOwnEvidenceAction,
  PlanRequestChangesAction,
  PlanRestoreRevisionAction,
  PlanStartAction,
  PlanSubmitReviewAction,
  PlanSyncStepAction,
  PlanToTasksAction,
  PlanUpdateAction,
} from './application/plan-actions';
import { PlanEvidenceService } from './application/plan-evidence.service';
import { PlanReadService } from './application/plan-read.service';
import { StudioSourceCheck } from './application/studio-source.check';
import { PlanEvidenceController } from './presentation/http/plan-evidence.controller';
import { PlansController } from './presentation/http/plans.controller';

@Module({
  imports: [CardsModule],
  controllers: [PlansController, PlanEvidenceController],
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
    PlanAddEvidenceAction,
    PlanRemoveEvidenceAction,
    PlanRemoveOwnEvidenceAction,
    PlanEvidenceService,
  ],
  exports: [PlanReadService, StudioSourceCheck, PlanEvidenceService],
})
export class PlansModule {}
