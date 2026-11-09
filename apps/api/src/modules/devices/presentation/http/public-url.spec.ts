/**
 * @file Where a device reaches the API: never the bind address a published Hub sees on each request (docs/16 D43).
 */
import type { Request } from 'express';

import { publicApiUrl } from './public-url';

const request = (headers: Record<string, string>) =>
  ({ header: (name: string) => headers[name.toLowerCase()] }) as unknown as Request;
// What the API sees behind `tailscale serve` and the web's proxy: the bind address, whatever the browser used.
const behindTailscale = request({
  host: 'localhost:7310',
  'x-forwarded-host': '127.0.0.1:7300',
  'x-forwarded-proto': 'https',
});

describe('publicApiUrl', () => {
  it('takes HUB_API_PUBLIC_URL first', () => {
    const config = {
      HUB_API_PUBLIC_URL: 'https://main.tail1.ts.net/',
      HUB_PUBLIC_URL: 'https://main.tail1.ts.net',
      PORT: 7310,
    };
    expect(publicApiUrl(config, behindTailscale)).toBe('https://main.tail1.ts.net');
  });

  it('uses the published https address, not the host of the request', () => {
    const config = { HUB_API_PUBLIC_URL: undefined, HUB_PUBLIC_URL: 'https://main.tail1.ts.net', PORT: 7310 };
    expect(publicApiUrl(config, behindTailscale)).toBe('https://main.tail1.ts.net');
  });

  it('on the first release’s plain http, follows the host the browser used, on the API port', () => {
    const config = { HUB_API_PUBLIC_URL: undefined, HUB_PUBLIC_URL: 'http://localhost:7300', PORT: 7310 };
    expect(publicApiUrl(config, request({ host: '192.168.1.20:7300' }))).toBe('http://192.168.1.20:7310');
  });
});
