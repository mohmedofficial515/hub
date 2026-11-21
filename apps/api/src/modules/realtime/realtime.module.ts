/**
 * @file Realtime: Redis pub/sub to one SSE stream per open page of a member. `RealtimePublisher` lives in
 * infra/redis, because every module publishes through it.
 */
import { Module } from '@nestjs/common';

import { RealtimeHub, RealtimeTimings } from './application/realtime-hub';
import { EventsController } from './presentation/http/events.controller';

@Module({
  controllers: [EventsController],
  providers: [RealtimeHub, RealtimeTimings],
  exports: [RealtimeHub],
})
export class RealtimeModule {}
