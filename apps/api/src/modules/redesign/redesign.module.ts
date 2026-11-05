/**
 * @file Redesign versions: review, approval and porting. The lab scanner joins this module in H2-05.
 */
import { Module } from '@nestjs/common';

import { CardsModule } from '@/modules/cards';

import { LabFilesService } from './application/lab-files.service';
import { LabReadService } from './application/lab-read.service';
import { LabScannerService } from './application/lab-scanner.service';
import {
  LabWriteBack,
  RedesignApproveAction,
  RedesignCreateAction,
  RedesignMarkPortedAction,
  RedesignRejectAction,
  RedesignRequestChangesAction,
  RedesignSendToReviewAction,
} from './application/redesign-actions';
import { RedesignSyncAction } from './application/redesign-sync.action';
import { LabFilesController, RedesignController } from './presentation/http/redesign.controller';

@Module({
  imports: [CardsModule],
  controllers: [RedesignController, LabFilesController],
  providers: [
    LabFilesService,
    LabReadService,
    LabScannerService,
    LabWriteBack,
    RedesignSyncAction,
    RedesignCreateAction,
    RedesignSendToReviewAction,
    RedesignApproveAction,
    RedesignRejectAction,
    RedesignRequestChangesAction,
    RedesignMarkPortedAction,
  ],
  exports: [LabFilesService, LabReadService, LabScannerService],
})
export class RedesignModule {}
