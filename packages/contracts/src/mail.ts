/**
 * @file Hub's mail server, as Settings › System shows it and an invite reports it (docs/16 D68). Never the password.
 */
import { z } from 'zod';

/**
 * Where Hub's mail goes (docs/16 D68): `real` is an SMTP server outside this machine (Gmail), `local` is a test inbox on it
 * (Mailpit), `off` is no mail server. An invite says which, so the owner knows whether the friend gets an email.
 */
export const MAIL_MODES = ['real', 'local', 'off'] as const;
export type MailMode = (typeof MAIL_MODES)[number];
export const mailModeSchema = z.enum(MAIL_MODES);
/** Settings › System › Mail (docs/16 D68). Never the password: only whether one is set. */
export const mailStatusSchema = z.object({
  mode: mailModeSchema,
  host: z.string().nullable(),
  port: z.number().int().nullable(),
  /** TLS from the first byte (port 465). */
  secure: z.boolean(),
  /** Whether SMTP_USER and SMTP_PASS are both set. */
  authenticated: z.boolean(),
  from: z.string().nullable(),
});
export type MailStatusDto = z.infer<typeof mailStatusSchema>;
export const MAIL_TEST_FAILURES = [
  'not_configured',
  'auth',
  'connection',
  'tls',
  'rejected',
  'unknown',
] as const;
export type MailTestFailure = (typeof MAIL_TEST_FAILURES)[number];
/** The test message to the owner's own address: sent, or why not, in words the page translates. */
export const mailTestResultSchema = z.object({
  sent: z.boolean(),
  to: z.string(),
  mode: mailModeSchema,
  failure: z.enum(MAIL_TEST_FAILURES).nullable(),
  /** The SMTP reply code when the server answered one, such as 535 for a refused login. */
  responseCode: z.number().int().nullable(),
});
export type MailTestResultDto = z.infer<typeof mailTestResultSchema>;
