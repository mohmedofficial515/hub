/**
 * @file In-app notifications (docs/07, docs/15 §3). Channels are deferred: `OutboxProcessor.registerSender` connects them.
 */
import { Module } from '@nestjs/common';

import { OutboxModule } from '@/infra/outbox/outbox';
import { CardsModule } from '@/modules/cards';

import { InboxService } from './application/inbox.service';
import { NotificationWriter } from './application/notification.writer';
import { NotificationsHook } from './application/notifications.hook';
import { InboxController } from './presentation/http/inbox.controller';

@Module({
  imports: [CardsModule, OutboxModule],
  controllers: [InboxController],
  providers: [InboxService, NotificationWriter, NotificationsHook],
  exports: [InboxService, NotificationWriter],
})
export class NotificationsModule {}
