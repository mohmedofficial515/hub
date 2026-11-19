/**
 * @file Ideas: what is worth thinking about (D29).
 */
import { Module } from '@nestjs/common';

import { CardsModule } from '@/modules/cards';
import { PlansModule } from '@/modules/plans';

import {
  IdeaAcceptAction,
  IdeaCreateAction,
  IdeaExploreAction,
  IdeaParkAction,
  IdeaRejectAction,
  IdeaReopenAction,
  IdeaToPlanAction,
  IdeaUpdateAction,
} from './application/idea-actions';
import { IdeasController } from './presentation/http/ideas.controller';

@Module({
  imports: [CardsModule, PlansModule],
  controllers: [IdeasController],
  providers: [
    IdeaCreateAction,
    IdeaUpdateAction,
    IdeaExploreAction,
    IdeaAcceptAction,
    IdeaParkAction,
    IdeaRejectAction,
    IdeaReopenAction,
    IdeaToPlanAction,
  ],
})
export class IdeasModule {}
