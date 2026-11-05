/**
 * @file Where a device reaches this API. `HUB_API_PUBLIC_URL` when set, else the host the browser used, on the API's own port.
 */
import type { Request } from 'express';

import type { AppConfig } from '@/config/config.module';

export function publicApiUrl(config: AppConfig, request: Request): string {
  if (config.HUB_API_PUBLIC_URL) return config.HUB_API_PUBLIC_URL.replace(/\/+$/, '');
  const host = request.header('x-forwarded-host') ?? request.header('host') ?? 'localhost';
  const hostname = /^(\[[^\]]+\]|[^:,\s]+)/.exec(host)?.[1] ?? 'localhost';
  const proto = request.header('x-forwarded-proto') === 'https' ? 'https' : 'http';
  return `${proto}://${hostname}:${config.PORT}`;
}
