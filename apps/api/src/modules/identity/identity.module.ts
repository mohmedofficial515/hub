/**
 * @file Identity module: sign-in, sessions, TOTP, API tokens, invites and the actor pipeline (docs/12 H0-03).
 * @description `ActorGuard` runs first and `RateLimitGuard` after it, so limits know who is calling.
 */
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { APP_CONFIG, type AppConfig } from '@/config/config.module';
import { OutboxModule } from '@/infra/outbox/outbox';
import { RateLimitGuard } from '@/infra/throttler/rate-limit.guard';
import { AuditModule } from '@/modules/audit';
import { SecretCipher } from '@/shared/security/secret-cipher';

import { AccountAdmin } from './application/account-admin.service';
import { ActorService } from './application/actor.service';
import { ApiTokenService } from './application/api-token.service';
import { AuthService } from './application/auth.service';
import { CredentialTokens } from './application/credential-tokens.service';
import { InviteService } from './application/invite.service';
import { LoginGuard } from './application/login-guard.service';
import { MeService } from './application/me.service';
import { OwnerSeed } from './application/owner-seed.service';
import { PasswordHasher } from './application/password-hasher';
import { Mailer } from './application/ports/mailer';
import { MembershipRepository } from './application/ports/membership.repository';
import { PRINCIPAL_RESOLVER } from './application/ports/principal-resolver';
import { SessionService } from './application/session.service';
import { TotpService } from './application/totp.service';
import { TotpPolicy } from './application/totp-policy.service';
import { PrismaMembershipRepository } from './infrastructure/prisma-membership.repository';
import { SmtpMailer } from './infrastructure/smtp-mailer';
import { ActorGuard } from './presentation/actor.guard';
import { CredentialsResolver } from './presentation/credentials.resolver';
import { AuthController } from './presentation/http/auth.controller';
import { PublicInvitesController, WorkspaceInvitesController } from './presentation/http/invites.controller';
import { MeController } from './presentation/http/me.controller';

@Module({
  imports: [AuditModule, OutboxModule],
  controllers: [AuthController, MeController, PublicInvitesController, WorkspaceInvitesController],
  providers: [
    AccountAdmin,
    ActorService,
    ApiTokenService,
    AuthService,
    CredentialTokens,
    InviteService,
    LoginGuard,
    MeService,
    OwnerSeed,
    PasswordHasher,
    SessionService,
    TotpPolicy,
    TotpService,
    {
      provide: SecretCipher,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => new SecretCipher(config.HUB_SECRET_KEY),
    },
    { provide: Mailer, useClass: SmtpMailer },
    { provide: MembershipRepository, useClass: PrismaMembershipRepository },
    { provide: PRINCIPAL_RESOLVER, useClass: CredentialsResolver },
    { provide: APP_GUARD, useClass: ActorGuard },
    { provide: APP_GUARD, useClass: RateLimitGuard },
  ],
  exports: [
    AccountAdmin,
    ActorService,
    InviteService,
    OwnerSeed,
    PRINCIPAL_RESOLVER,
    SecretCipher,
    TotpPolicy,
  ],
})
export class IdentityModule {}
