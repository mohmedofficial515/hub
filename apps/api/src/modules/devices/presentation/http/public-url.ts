/**
 * @file Where a device reaches this API: `HUB_API_PUBLIC_URL` when set; once Hub is published at an https address, that address, since
 * `tailscale serve` sends `/mcp` and `/bridge` there (docs/16 D43); before that, the host the browser used, on the API's own port.
 * @description Behind `tailscale serve` and the web's proxy, the request's host is the bind address (`127.0.0.1:7300`), so a published
 * Hub never builds an address from the request.
 */
import type { Request } from 'express';

import type { AppConfig } from '@/config/config.module';

type UrlConfig = Pick<AppConfig, 'HUB_API_PUBLIC_URL' | 'HUB_PUBLIC_URL' | 'PORT'>;

export function publicApiUrl(config: UrlConfig, request: Request): string {
  if (config.HUB_API_PUBLIC_URL) return config.HUB_API_PUBLIC_URL.replace(/\/+$/, '');
  if (config.HUB_PUBLIC_URL.startsWith('https://')) return new URL(config.HUB_PUBLIC_URL).origin;
  const host = request.header('x-forwarded-host') ?? request.header('host') ?? 'localhost';
  const hostname = /^(\[[^\]]+\]|[^:,\s]+)/.exec(host)?.[1] ?? 'localhost';
  const proto = request.header('x-forwarded-proto') === 'https' ? 'https' : 'http';
  return `${proto}://${hostname}:${config.PORT}`;
}
