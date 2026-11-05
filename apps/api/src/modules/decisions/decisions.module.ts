/**
 * @file Decisions: options, decide, withdraw, supersede and the ADR draft.
 */
import { Module } from '@nestjs/common';

import { CardsModule } from '@/modules/cards';

import {
  DecisionCreateAction,
  DecisionDecideAction,
  DecisionDraftAdrAction,
  DecisionEditOptionsAction,
  DecisionSupersedeAction,
  DecisionWithdrawAction,
} from './application/decision-actions';
import { DecisionsController } from './presentation/http/decisions.controller';

@Module({
  imports: [CardsModule],
  controllers: [DecisionsController],
  providers: [
    DecisionCreateAction,
    DecisionEditOptionsAction,
    DecisionDecideAction,
    DecisionWithdrawAction,
    DecisionSupersedeAction,
    DecisionDraftAdrAction,
  ],
})
export class DecisionsModule {}
