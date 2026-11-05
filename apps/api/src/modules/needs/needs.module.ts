/**
 * @file Needs: what is required from outside, delivered by location, verified by the requester or responsible role.
 */
import { Module } from '@nestjs/common';

import { CardsModule } from '@/modules/cards';

import {
  NeedCancelAction,
  NeedCreateAction,
  NeedDeliverAction,
  NeedRejectDeliveryAction,
  NeedStartAction,
  NeedVerifyAction,
} from './application/need-actions';
import { NeedsController } from './presentation/http/needs.controller';

@Module({
  imports: [CardsModule],
  controllers: [NeedsController],
  providers: [
    NeedCreateAction,
    NeedStartAction,
    NeedDeliverAction,
    NeedVerifyAction,
    NeedRejectDeliveryAction,
    NeedCancelAction,
  ],
})
export class NeedsModule {}
