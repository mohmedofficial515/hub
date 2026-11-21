/**
 * @file Handoffs: work one role passes to another.
 */
import { Module } from '@nestjs/common';

import { CardsModule } from '@/modules/cards';

import {
  HandoffAcknowledgeAction,
  HandoffApplyAction,
  HandoffCreateAction,
  HandoffDismissAction,
} from './application/handoff-actions';
import { HandoffsController } from './presentation/http/handoffs.controller';

@Module({
  imports: [CardsModule],
  controllers: [HandoffsController],
  providers: [HandoffCreateAction, HandoffAcknowledgeAction, HandoffApplyAction, HandoffDismissAction],
})
export class HandoffsModule {}
