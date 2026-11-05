/**
 * @file Cards core. Type modules import this and declare `@CardActionHandler()` providers.
 */
import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';

import { OutboxModule } from '@/infra/outbox/outbox';
import { AuditModule } from '@/modules/audit';

import { CardService } from './application/card.service';
import { CardActionRegistry } from './application/card-action.registry';
import { CardRepository } from './application/ports/card.repository';
import { PrismaCardRepository } from './infrastructure/prisma-card.repository';
import { CardsController } from './presentation/http/cards.controller';

@Module({
  imports: [DiscoveryModule, AuditModule, OutboxModule],
  controllers: [CardsController],
  providers: [CardService, CardActionRegistry, { provide: CardRepository, useClass: PrismaCardRepository }],
  exports: [CardService, CardActionRegistry, CardRepository],
})
export class CardsModule {}
