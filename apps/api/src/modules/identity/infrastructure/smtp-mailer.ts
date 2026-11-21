/**
 * @file Mail through nodemailer: Mailpit on this machine, or a real server with a login, such as Gmail on 465 with an app password (docs/16 D68).
 * @description With no SMTP host, messages are dropped: invite and reset links are still returned to the owner who asked for them, so
 * nothing depends on a mail server (docs/15 §3). The password reaches the transport only. It is never stored, logged or returned, and
 * nodemailer's own logger stays off, because it would print the login.
 */
import { Inject, Injectable, Logger } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';

import { APP_CONFIG, type AppConfig } from '@/config/config.module';

import { Mailer, type MailMessage } from '../application/ports/mailer';
import { mailFromOf, smtpOptionsOf } from '../domain/mail-config';

@Injectable()
export class SmtpMailer extends Mailer {
  private readonly logger = new Logger(SmtpMailer.name);
  private readonly transport: Transporter | null;
  private readonly from: string;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    super();
    this.from = mailFromOf(config);
    const options = smtpOptionsOf(config);
    this.transport = options ? createTransport({ ...options, logger: false, debug: false }) : null;
  }

  async send(message: MailMessage): Promise<void> {
    if (!this.transport) {
      this.logger.debug('Mail is not configured; a message was dropped');
      return;
    }
    await this.transport.sendMail({ from: this.from, ...message });
  }
}
