/**
 * @file Settings › System › Mail (docs/16 D68): where Hub's mail goes, and a test message to the owner's own address.
 * @description The state comes from the environment only, and never holds the password. A failed test is an answer, not an error: the page
 * says in the owner's words what to fix, from `mailFailureOf`. Only the code and the SMTP reply number are logged.
 */
import type { MailStatusDto, MailTestResultDto, MemberActor } from '@hub/contracts';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';

import { APP_CONFIG, type AppConfig } from '@/config/config.module';
import { type PrismaTransactionalAdapter } from '@/infra/prisma/prisma.module';
import { AuditService } from '@/modules/audit';

import { testMail } from '../domain/invite-mail';
import { mailFailureOf, mailStatusOf } from '../domain/mail-config';
import { Mailer } from './ports/mailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    private readonly txHost: TransactionHost<PrismaTransactionalAdapter>,
    private readonly mailer: Mailer,
    private readonly audit: AuditService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  status(): MailStatusDto {
    return mailStatusOf(this.config);
  }

  /** Sends one message to the actor's own address and waits for the server's answer. */
  async sendTest(actor: MemberActor): Promise<MailTestResultDto> {
    const user = await this.txHost.tx.user.findUniqueOrThrow({
      where: { id: actor.userId },
      select: { email: true, locale: true },
    });
    const status = this.status();
    const answer = (failure: MailTestResultDto['failure'], responseCode: number | null = null) => ({
      sent: failure === null,
      to: user.email,
      mode: status.mode,
      failure,
      responseCode,
    });
    if (status.mode === 'off' || !status.host) return answer('not_configured');
    let result: MailTestResultDto;
    try {
      await this.mailer.send({ to: user.email, ...testMail(user.locale, status.host) });
      result = answer(null);
    } catch (error) {
      const { failure, responseCode } = mailFailureOf(error);
      this.logger.warn(`Test mail failed: ${failure}${responseCode ? ` (${responseCode})` : ''}`);
      result = answer(failure, responseCode);
    }
    await this.audit.record(actor, {
      action: 'identity.mail.test',
      targetType: 'user',
      targetId: actor.userId,
      summary: result.sent
        ? `Sent a test email through ${status.host}`
        : `A test email through ${status.host} failed: ${result.failure}`,
    });
    return result;
  }
}
