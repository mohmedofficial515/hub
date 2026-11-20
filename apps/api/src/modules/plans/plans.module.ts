/**
 * @file Plans: a written approach that becomes work (D29).
 */
import { Module } from '@nestjs/common';

import { CardsModule } from '@/modules/cards';

import { AttachmentStore } from './application/attachment-store';
import {
  PlanAbandonAction,
  PlanAddEvidenceAction,
  PlanApproveAction,
  PlanAttachExplainerAction,
  PlanCreateAction,
  PlanFinishAction,
  PlanRemoveEvidenceAction,
  PlanRemoveOwnEvidenceAction,
  PlanRequestChangesAction,
  PlanRequestExplainerAction,
  PlanRestoreRevisionAction,
  PlanStartAction,
  PlanSubmitReviewAction,
  PlanSyncStepAction,
  PlanToTasksAction,
  PlanUpdateAction,
} from './application/plan-actions';
import { PlanEvidenceService } from './application/plan-evidence.service';
import { PlanExplainerService } from './application/plan-explainer.service';
import { PlanReadService } from './application/plan-read.service';
import { StudioSourceCheck } from './application/studio-source.check';
import { PlanEvidenceController } from './presentation/http/plan-evidence.controller';
import { PlanExplainerController } from './presentation/http/plan-explainer.controller';
import { PlansController } from './presentation/http/plans.controller';

@Module({
  imports: [CardsModule],
  controllers: [PlansController, PlanEvidenceController, PlanExplainerController],
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
    PlanRequestExplainerAction,
    PlanAttachExplainerAction,
    AttachmentStore,
    PlanEvidenceService,
    PlanExplainerService,
  ],
  exports: [PlanReadService, StudioSourceCheck, PlanEvidenceService, PlanExplainerService],
})
export class PlansModule {}
