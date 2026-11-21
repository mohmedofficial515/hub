/**
 * @file The agent queue (docs/16 §9): runs that Hub starts as panel chat turns, at their time and within the owner's limits.
 */
import { Module } from '@nestjs/common';

import { AuditModule } from '@/modules/audit';
import { CardsModule } from '@/modules/cards';
import { ChatsModule } from '@/modules/chats';
import { DevicesModule } from '@/modules/devices';
import { IdentityModule } from '@/modules/identity';
import { NotificationsModule } from '@/modules/notifications';
import { WorkspacesModule } from '@/modules/workspaces';

import { PlanRunsService } from './application/plan-runs.service';
import { AgentQueueService } from './application/queue.service';
import { AgentQueueDispatcher } from './application/queue-dispatcher';
import { AgentQueueStore } from './application/queue-store';
import { PlanRunsController } from './presentation/http/plan-runs.controller';
import { AgentQueueController } from './presentation/http/queue.controller';

@Module({
  imports: [
    AuditModule,
    CardsModule,
    ChatsModule,
    DevicesModule,
    IdentityModule,
    NotificationsModule,
    WorkspacesModule,
  ],
  controllers: [AgentQueueController, PlanRunsController],
  providers: [AgentQueueStore, AgentQueueDispatcher, AgentQueueService, PlanRunsService],
  exports: [AgentQueueService, AgentQueueDispatcher, PlanRunsService],
})
export class AgentQueueModule {}
