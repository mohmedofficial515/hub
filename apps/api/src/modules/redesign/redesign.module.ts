/**
 * @file Redesign versions: review, approval and porting. The lab scanner joins this module in H2-05.
 */
import { Module } from '@nestjs/common';

import { CardsModule } from '@/modules/cards';

import {
  RedesignApproveAction,
  RedesignCreateAction,
  RedesignMarkPortedAction,
  RedesignRejectAction,
  RedesignRequestChangesAction,
  RedesignSendToReviewAction,
} from './application/redesign-actions';
import { RedesignController } from './presentation/http/redesign.controller';

@Module({
  imports: [CardsModule],
  controllers: [RedesignController],
  providers: [
    RedesignCreateAction,
    RedesignSendToReviewAction,
    RedesignApproveAction,
    RedesignRejectAction,
    RedesignRequestChangesAction,
    RedesignMarkPortedAction,
  ],
})
export class RedesignModule {}
