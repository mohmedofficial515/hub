/**
 * @file Port for sending mail. Mailpit over SMTP in development (docs/15 §3); nothing when unconfigured.
 */
export interface MailMessage {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
}

export abstract class Mailer {
  /** Throws when delivery fails. Callers treat mail as best effort and never log the message body. */
  abstract send(message: MailMessage): Promise<void>;
}
