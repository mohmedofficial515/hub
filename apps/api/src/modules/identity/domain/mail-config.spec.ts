/**
 * @file Where Hub's mail goes, from the environment (docs/16 D68): Gmail on 465 with an app password, Mailpit, or none.
 */
import { mailFailureOf, mailModeOf, mailStatusOf, smtpOptionsOf } from './mail-config';

const gmail = {
  MAIL_PROVIDER: 'smtp' as const,
  SMTP_HOST: 'smtp.gmail.com',
  SMTP_PORT: 465,
  SMTP_SECURE: 'true' as const,
  SMTP_USER: 'owner@gmail.com',
  SMTP_PASS: 'abcd efgh ijkl mnop',
  MAIL_FROM: 'Hub <owner@gmail.com>',
};
const mailpit = {
  MAIL_PROVIDER: 'smtp' as const,
  SMTP_HOST: 'localhost',
  SMTP_PORT: 7342,
  SMTP_SECURE: 'false' as const,
};

describe('mail config', () => {
  it('reads Gmail as real email over TLS with a login, and never puts the password in the status', () => {
    expect(mailModeOf(gmail)).toBe('real');
    const status = mailStatusOf(gmail);
    expect(status).toEqual({
      mode: 'real',
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      authenticated: true,
      from: 'Hub <owner@gmail.com>',
    });
    expect(JSON.stringify(status)).not.toContain(gmail.SMTP_PASS);
    expect(smtpOptionsOf(gmail)).toMatchObject({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user: 'owner@gmail.com', pass: gmail.SMTP_PASS },
    });
  });

  it('reads Mailpit on this machine as the local test inbox, with no login', () => {
    expect(mailModeOf(mailpit)).toBe('local');
    for (const host of ['127.0.0.1', '::1', 'mailpit', 'mail.localhost']) {
      expect(mailModeOf({ ...mailpit, SMTP_HOST: host })).toBe('local');
    }
    expect(mailStatusOf(mailpit)).toMatchObject({ authenticated: false, from: 'Hub <hub@localhost>' });
    expect(smtpOptionsOf(mailpit)).not.toHaveProperty('auth');
  });

  it('is off without SMTP, and defaults the port and sender sensibly', () => {
    expect(mailModeOf({ MAIL_PROVIDER: 'none', SMTP_SECURE: 'false' })).toBe('off');
    expect(mailModeOf({ MAIL_PROVIDER: 'smtp', SMTP_SECURE: 'false' })).toBe('off');
    expect(mailModeOf({ MAIL_PROVIDER: 'resend', SMTP_SECURE: 'false', SMTP_HOST: 'smtp.gmail.com' })).toBe(
      'off',
    );
    expect(smtpOptionsOf({ MAIL_PROVIDER: 'none', SMTP_SECURE: 'false' })).toBeNull();
    const noPort = { ...gmail, SMTP_PORT: undefined, MAIL_FROM: undefined };
    expect(mailStatusOf(noPort)).toMatchObject({ port: 465, from: 'Hub <owner@gmail.com>' });
    expect(mailStatusOf({ ...noPort, SMTP_SECURE: 'false' })).toMatchObject({ port: 587 });
  });

  it('turns nodemailer’s errors into a reason the page can say', () => {
    expect(mailFailureOf({ code: 'EAUTH', responseCode: 535, message: 'Invalid login: 535-5.7.8' })).toEqual({
      failure: 'auth',
      responseCode: 535,
    });
    expect(mailFailureOf({ code: 'ESOCKET', message: 'connect ECONNREFUSED 127.0.0.1:465' }).failure).toBe(
      'connection',
    );
    expect(mailFailureOf({ code: 'ETIMEDOUT', message: 'Greeting never received' }).failure).toBe(
      'connection',
    );
    expect(mailFailureOf({ code: 'ESOCKET', message: 'wrong version number' }).failure).toBe('tls');
    expect(mailFailureOf({ code: 'EENVELOPE', responseCode: 550 }).failure).toBe('rejected');
    expect(mailFailureOf(new Error('odd')).failure).toBe('unknown');
  });
});
