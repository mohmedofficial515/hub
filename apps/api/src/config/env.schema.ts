/**
 * @file Environment schema (docs/13 env catalogue, docs/15 §3 and §9).
 * @description Only what a local run cannot work without is required.
 */
import { z } from 'zod';

const optionalText = z
  .string()
  .optional()
  .transform((value) => (value === '' ? undefined : value));

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PROCESS_ROLE: z.enum(['api', 'worker', 'all']).default('all'),
  PORT: z.coerce.number().int().positive().default(7310),
  /** Overrides the per-user limit of docs/04 §1.7. Only the throwaway browser stack sets it: one test user makes every page load of a whole suite. */
  HUB_RATE_LIMIT_USER: z.coerce.number().int().positive().optional(),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  HUB_PUBLIC_URL: z.url().default('http://localhost:7300'),
  /** Where another device reaches this API: `/mcp`, `/bridge` and the connect script. Unset: the host the browser used, on PORT. */
  HUB_API_PUBLIC_URL: optionalText,
  HUB_ALLOWED_HOSTS: z.string().default('localhost,127.0.0.1'),
  /** Express `trust proxy`, when a proxy stands in front: `uniquelocal` in compose. Unset: trust nothing. */
  TRUST_PROXY: optionalText,

  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  HUB_SECRET_KEY: z
    .string()
    .refine((value) => Buffer.from(value, 'base64').length === 32, 'must be base64 of 32 bytes'),

  /** `inline` runs jobs synchronously in the same process, for deterministic tests (docs/11 §1.1). */
  QUEUE_MODE: z.enum(['bullmq', 'inline']).default('bullmq'),
  REPOS_ROOT: z.string().default('.tmp/repos'),

  // Identity (H0-03). HS256 signing key of the access token and the TOTP challenge.
  HUB_JWT_SECRET: z.string().min(32),
  SESSION_COOKIE_DOMAIN: optionalText,
  HUB_OWNER_EMAIL: optionalText,
  HUB_OWNER_PASSWORD: optionalText,
  HUB_OWNER_NAME: optionalText,

  // Local path mode. Unset, the lab is the repository's own `apps/lab`, and a source may point at any folder.
  LAB_ROOT: optionalText,

  // Deferred channels: unset means the channel shows "not connected"
  METRICS_TOKEN: optionalText,
  VAPID_PUBLIC_KEY: optionalText,
  VAPID_PRIVATE_KEY: optionalText,
  VAPID_SUBJECT: optionalText,
  TELEGRAM_BOT_TOKEN: optionalText,
  MAIL_PROVIDER: z.enum(['resend', 'smtp', 'none']).default('none'),
  RESEND_API_KEY: optionalText,
  SMTP_HOST: optionalText,
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_USER: optionalText,
  SMTP_PASS: optionalText,
  SMTP_SECURE: z.enum(['true', 'false']).default('false'),
  MAIL_FROM: optionalText,
});

export type Env = z.infer<typeof envSchema>;
