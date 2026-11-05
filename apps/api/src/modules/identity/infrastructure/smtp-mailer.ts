/**
 * @file Mail through nodemailer. With no SMTP host, messages are dropped: invite and reset links are
 * still returned to the owner who asked for them, so nothing depends on a mail server (docs/15 §3).
 */
import { Inject, Injectable, Logger } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';

import { APP_CONFIG, type AppConfig } from '@/config/config.module';

import { Mailer, type MailMessage } from '../application/ports/mailer';

@Injectable()
export class SmtpMailer extends Mailer {
  private readonly logger = new Logger(SmtpMailer.name);
  private readonly transport: Transporter | null;
  private readonly from: string;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    super();
    this.from = config.MAIL_FROM ?? 'Hub <hub@localhost>';
    this.transport =
      config.MAIL_PROVIDER === 'smtp' && config.SMTP_HOST
        ? createTransport({
            host: config.SMTP_HOST,
            port: config.SMTP_PORT ?? 587,
            secure: config.SMTP_SECURE === 'true',
            ...(config.SMTP_USER && config.SMTP_PASS
              ? { auth: { user: config.SMTP_USER, pass: config.SMTP_PASS } }
              : {}),
          })
        : null;
  }

  async send(message: MailMessage): Promise<void> {
    if (!this.transport) {
      this.logger.debug('Mail is not configured; a message was dropped');
      return;
    }
    await this.transport.sendMail({ from: this.from, ...message });
  }
}
