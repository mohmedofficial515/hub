/**
 * @file Hub's mail server from the environment (docs/16 D68): Mailpit on this machine, a real SMTP server such as Gmail, or none.
 * @description Pure, so the mailer, the invite and Settings › System read one rule. The password goes into the transport and nowhere else:
 * the status says only whether one is set.
 */
import type { MailMode, MailStatusDto, MailTestFailure } from '@hub/contracts';

export interface MailConfig {
  readonly MAIL_PROVIDER: 'resend' | 'smtp' | 'none';
  readonly SMTP_HOST?: string | undefined;
  readonly SMTP_PORT?: number | undefined;
  readonly SMTP_USER?: string | undefined;
  readonly SMTP_PASS?: string | undefined;
  readonly SMTP_SECURE: 'true' | 'false';
  readonly MAIL_FROM?: string | undefined;
}

/** A server on this machine is a test inbox: nothing it takes reaches anyone's real mailbox. */
const LOCAL_HOST =
  /^(localhost|127(\.\d{1,3}){3}|::1|\[::1\]|0\.0\.0\.0|mailpit|host\.docker\.internal|.+\.localhost)$/i;

export function isLocalMailHost(host: string): boolean {
  return LOCAL_HOST.test(host.trim());
}

export function mailModeOf(config: MailConfig): MailMode {
  if (config.MAIL_PROVIDER !== 'smtp' || !config.SMTP_HOST) return 'off';
  return isLocalMailHost(config.SMTP_HOST) ? 'local' : 'real';
}

/** The sender: MAIL_FROM, else the account that signs in, as Gmail sends from it whatever the message says. */
export function mailFromOf(config: MailConfig): string {
  if (config.MAIL_FROM) return config.MAIL_FROM;
  return config.SMTP_USER ? `Hub <${config.SMTP_USER}>` : 'Hub <hub@localhost>';
}

export function mailStatusOf(config: MailConfig): MailStatusDto {
  const mode = mailModeOf(config);
  const secure = config.SMTP_SECURE === 'true';
  if (mode === 'off') {
    return { mode, host: null, port: null, secure: false, authenticated: false, from: null };
  }
  return {
    mode,
    host: config.SMTP_HOST ?? null,
    port: config.SMTP_PORT ?? (secure ? 465 : 587),
    secure,
    authenticated: Boolean(config.SMTP_USER && config.SMTP_PASS),
    from: mailFromOf(config),
  };
}

/** What nodemailer is given. Short timeouts: the test button answers within half a minute, and an invite never waits for mail anyway. */
export function smtpOptionsOf(config: MailConfig) {
  const status = mailStatusOf(config);
  if (status.mode === 'off' || !status.host) return null;
  return {
    host: status.host,
    port: status.port ?? 587,
    secure: status.secure,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
    ...(config.SMTP_USER && config.SMTP_PASS
      ? { auth: { user: config.SMTP_USER, pass: config.SMTP_PASS } }
      : {}),
  };
}

/** Why a send failed, from nodemailer's error, in a word the page translates. Never the server's text, which may quote the login. */
export function mailFailureOf(error: unknown): { failure: MailTestFailure; responseCode: number | null } {
  const shape = (error ?? {}) as { code?: unknown; responseCode?: unknown; message?: unknown };
  const code = typeof shape.code === 'string' ? shape.code : '';
  const responseCode = typeof shape.responseCode === 'number' ? shape.responseCode : null;
  const message = typeof shape.message === 'string' ? shape.message : '';
  if (code === 'EAUTH' || responseCode === 535 || responseCode === 534)
    return { failure: 'auth', responseCode };
  if (code === 'ETLS' || /\b(ssl|tls|certificate|wrong version number)\b/i.test(message)) {
    return { failure: 'tls', responseCode };
  }
  if (
    ['ECONNECTION', 'ETIMEDOUT', 'EDNS', 'ECONNREFUSED', 'ENOTFOUND', 'EHOSTUNREACH'].includes(code) ||
    (code === 'ESOCKET' && /ECONNREFUSED|ENOTFOUND|EHOSTUNREACH|ETIMEDOUT|ECONNRESET|EAI_AGAIN/.test(message))
  ) {
    return { failure: 'connection', responseCode };
  }
  if (code === 'EENVELOPE' || code === 'EMESSAGE' || (responseCode !== null && responseCode >= 500)) {
    return { failure: 'rejected', responseCode };
  }
  return { failure: 'unknown', responseCode };
}
