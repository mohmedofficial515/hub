/**
 * @file Sign-in, TOTP challenge, password change, forgot and reset (docs/04 §3.2).
 * @description Lockout counts every wrong password or code. An unknown email gets the same answer and takes
 * the same time as a wrong password, and `forgot` always answers 202, so neither reveals who has an account.
 */
import type { Me } from '@hub/contracts';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';

import { APP_CONFIG, type AppConfig } from '@/config/config.module';
import { CLOCK, type Clock } from '@/infra/clock/clock';
import { type PrismaTransactionalAdapter } from '@/infra/prisma/prisma.module';
import { AuditService } from '@/modules/audit';
import { AppException } from '@/shared/errors';

import { newOpaqueToken, sha256 } from '../domain/credentials';
import { isWeakPassword } from '../domain/password-policy';
import { webSubject } from './account-audit';
import { CredentialTokens } from './credential-tokens.service';
import { LoginGuard } from './login-guard.service';
import { MeService } from './me.service';
import { PasswordHasher } from './password-hasher';
import { Mailer } from './ports/mailer';
import { type IssuedSession, SessionService } from './session.service';
import { TotpService } from './totp.service';

const RESET_TTL_MS = 3_600_000;
const ADMIN_RESET_TTL_MS = 24 * RESET_TTL_MS;

export type SignInOutcome =
  | { readonly totpRequired: true; readonly challenge: string }
  | { readonly totpRequired: false; readonly user: Me; readonly session: IssuedSession };

export type Authenticated = Extract<SignInOutcome, { totpRequired: false }>;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly txHost: TransactionHost<PrismaTransactionalAdapter>,
    private readonly hasher: PasswordHasher,
    private readonly guard: LoginGuard,
    private readonly sessions: SessionService,
    private readonly tokens: CredentialTokens,
    private readonly totp: TotpService,
    private readonly me: MeService,
    private readonly audit: AuditService,
    private readonly mailer: Mailer,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async signIn(rawEmail: string, password: string, ip: string): Promise<SignInOutcome> {
    const email = rawEmail.toLowerCase();
    await this.guard.assertNotLocked(email, ip);
    const user = await this.txHost.tx.user.findUnique({ where: { email } });
    const matches = user
      ? await this.hasher.verify(user.passwordHash, password)
      : await this.hasher.verifyNothing(password);
    if (!user || !matches) {
      await this.guard.record(email, ip, false);
      throw new AppException('hub.identity.invalid_credentials');
    }
    if (user.status !== 'active') throw new AppException('hub.identity.account_disabled');
    if (user.totpEnabledAt) {
      return { totpRequired: true, challenge: await this.tokens.signChallenge(user.id) };
    }
    return this.complete(user.id, email, ip);
  }

  async verifyTotp(challenge: string, code: string, ip: string): Promise<Authenticated> {
    const user = await this.challengedUser(challenge, ip);
    if (!(await this.totp.checkCode(user.id, code))) {
      await this.guard.record(user.email, ip, false);
      throw new AppException('hub.identity.totp_invalid');
    }
    return this.complete(user.id, user.email, ip);
  }

  async recover(challenge: string, recoveryCode: string, ip: string): Promise<Authenticated> {
    const user = await this.challengedUser(challenge, ip);
    if (!(await this.totp.consumeRecoveryCode(user.id, recoveryCode))) {
      await this.guard.record(user.email, ip, false);
      throw new AppException('hub.identity.totp_invalid');
    }
    await this.audit.recordAccount(webSubject(user.id), {
      action: 'identity.totp.recovery_used',
      targetType: 'user',
      targetId: user.id,
      summary: 'Signed in with a recovery code',
    });
    return this.complete(user.id, user.email, ip);
  }

  async changePassword(
    userId: string,
    familyId: string | null,
    current: string,
    next: string,
  ): Promise<void> {
    const user = await this.txHost.tx.user.findUniqueOrThrow({ where: { id: userId } });
    if (!(await this.hasher.verify(user.passwordHash, current))) {
      throw new AppException('hub.identity.invalid_credentials');
    }
    if (isWeakPassword(next)) throw new AppException('hub.identity.password_weak');
    const passwordHash = await this.hasher.hash(next);
    await this.txHost.withTransaction(async () => {
      await this.txHost.tx.user.update({ where: { id: userId }, data: { passwordHash } });
      await this.sessions.revokeAll(userId, familyId ?? undefined);
      await this.audit.recordAccount(webSubject(userId), {
        action: 'identity.password.change',
        targetType: 'user',
        targetId: userId,
        summary: 'Changed their password',
      });
    });
  }

  /** Always resolves; the caller answers 202 whether or not the account exists. */
  async forgotPassword(rawEmail: string): Promise<void> {
    const user = await this.txHost.tx.user.findUnique({ where: { email: rawEmail.toLowerCase() } });
    if (!user || user.status !== 'active') return;
    const token = await this.createReset(user.id, RESET_TTL_MS);
    const url = this.resetUrl(user.locale, token);
    const arabic = user.locale === 'ar';
    await this.deliver(
      user.email,
      arabic ? 'إعادة تعيين كلمة المرور في Hub' : 'Reset your Hub password',
      arabic
        ? `لإعادة تعيين كلمة المرور افتح هذا الرابط خلال ساعة:\n${url}\n\nإذا لم تطلب ذلك فتجاهل هذه الرسالة.`
        : `Open this link within an hour to reset your password:\n${url}\n\nIf you did not ask for this, ignore this message.`,
    );
  }

  async resetPassword(token: string, password: string): Promise<void> {
    const reset = await this.txHost.tx.passwordReset.findUnique({ where: { tokenHash: sha256(token) } });
    if (!reset || reset.usedAt || reset.expiresAt <= this.clock.now()) {
      throw new AppException('hub.identity.reset_invalid');
    }
    if (isWeakPassword(password)) throw new AppException('hub.identity.password_weak');
    const passwordHash = await this.hasher.hash(password);
    await this.txHost.withTransaction(async () => {
      const claimed = await this.txHost.tx.passwordReset.updateMany({
        where: { id: reset.id, usedAt: null },
        data: { usedAt: this.clock.now() },
      });
      if (claimed.count !== 1) throw new AppException('hub.identity.reset_invalid');
      await this.txHost.tx.user.update({ where: { id: reset.userId }, data: { passwordHash } });
      await this.sessions.revokeAll(reset.userId);
      await this.audit.recordAccount(webSubject(reset.userId), {
        action: 'identity.password.reset',
        targetType: 'user',
        targetId: reset.userId,
        summary: 'Reset their password',
      });
    });
  }

  /** A link an owner or pm hands to a member, valid 24 hours (docs/04 §3.23). Shown once, never logged. */
  async createAdminResetLink(userId: string, locale: string): Promise<string> {
    return this.resetUrl(locale, await this.createReset(userId, ADMIN_RESET_TTL_MS));
  }

  private async createReset(userId: string, ttlMs: number): Promise<string> {
    const token = newOpaqueToken();
    await this.txHost.tx.passwordReset.create({
      data: {
        userId,
        tokenHash: sha256(token),
        expiresAt: new Date(this.clock.now().getTime() + ttlMs),
        createdAt: this.clock.now(),
      },
    });
    return token;
  }

  private resetUrl(locale: string, token: string): string {
    return `${this.config.HUB_PUBLIC_URL.replace(/\/$/, '')}/${locale}/reset/${token}`;
  }

  /** Mail is best effort: a mail server being down must not reveal anything or fail the request. */
  private async deliver(to: string, subject: string, text: string): Promise<void> {
    try {
      await this.mailer.send({ to, subject, text });
    } catch (error) {
      this.logger.warn(`Mail failed: ${error instanceof Error ? error.name : 'unknown'}`);
    }
  }

  private async challengedUser(challenge: string, ip: string) {
    const userId = await this.tokens.verifyChallenge(challenge);
    if (!userId) throw new AppException('hub.identity.totp_invalid');
    const user = await this.txHost.tx.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppException('hub.identity.totp_invalid');
    if (user.status !== 'active') throw new AppException('hub.identity.account_disabled');
    await this.guard.assertNotLocked(user.email, ip);
    return user;
  }

  private async complete(userId: string, email: string, ip: string): Promise<Authenticated> {
    const session = await this.txHost.withTransaction(async () => {
      await this.guard.record(email, ip, true);
      const started = await this.sessions.start(userId);
      await this.audit.recordAccount(webSubject(userId), {
        action: 'identity.sign_in',
        targetType: 'user',
        targetId: userId,
        summary: 'Signed in',
      });
      return started;
    });
    return { totpRequired: false, user: await this.me.get(userId), session };
  }
}
