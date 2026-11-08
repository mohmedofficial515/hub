/**
 * @file Where the API listens: localhost once published over Tailscale, unchanged before (docs/16 §10).
 */
import { bindHostOf } from './bind-host';

describe('bindHostOf', () => {
  it('listens on 127.0.0.1 only when Hub is published at an https address', () => {
    expect(bindHostOf({ HUB_PUBLIC_URL: 'https://main-pc.tail1234.ts.net' })).toBe('127.0.0.1');
  });

  it('keeps every interface for the first release’s plain http', () => {
    expect(bindHostOf({ HUB_PUBLIC_URL: 'http://localhost:7300' })).toBeUndefined();
  });

  it('takes HUB_BIND_HOST over both', () => {
    expect(bindHostOf({ HUB_PUBLIC_URL: 'https://x.ts.net', HUB_BIND_HOST: '0.0.0.0' })).toBe('0.0.0.0');
    expect(bindHostOf({ HUB_PUBLIC_URL: 'http://localhost:7300', HUB_BIND_HOST: '127.0.0.1' })).toBe(
      '127.0.0.1',
    );
  });
});
