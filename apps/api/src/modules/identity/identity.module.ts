/**
 * @file Identity module: the actor pipeline. H0-03 adds sign-in, sessions, tokens and invites here.
 */
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { ActorService } from './application/actor.service';
import { MembershipRepository } from './application/ports/membership.repository';
import { NoPrincipalResolver, PRINCIPAL_RESOLVER } from './application/ports/principal-resolver';
import { PrismaMembershipRepository } from './infrastructure/prisma-membership.repository';
import { ActorGuard } from './presentation/actor.guard';

@Module({
  providers: [
    ActorService,
    { provide: MembershipRepository, useClass: PrismaMembershipRepository },
    { provide: PRINCIPAL_RESOLVER, useClass: NoPrincipalResolver },
    { provide: APP_GUARD, useClass: ActorGuard },
  ],
  exports: [ActorService, PRINCIPAL_RESOLVER],
})
export class IdentityModule {}
