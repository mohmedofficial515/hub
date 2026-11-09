/**
 * @file Where the API listens: localhost once published over Tailscale, unchanged before (docs/16 §10).
 */
import { bindHostOf, trustProxyOf } from './bind-host';

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

describe('trustProxyOf', () => {
  it('trusts the proxies on this machine once Hub listens on 127.0.0.1 only', () => {
    expect(trustProxyOf({ HUB_PUBLIC_URL: 'https://main-pc.tail1234.ts.net' })).toBe('loopback');
    expect(trustProxyOf({ HUB_PUBLIC_URL: 'http://localhost:7300', HUB_BIND_HOST: '127.0.0.1' })).toBe(
      'loopback',
    );
  });

  it('trusts nothing while Hub listens on every interface, where anyone could send the header', () => {
    expect(trustProxyOf({ HUB_PUBLIC_URL: 'http://localhost:7300' })).toBeUndefined();
    expect(trustProxyOf({ HUB_PUBLIC_URL: 'https://x.ts.net', HUB_BIND_HOST: '0.0.0.0' })).toBeUndefined();
  });

  it('takes TRUST_PROXY over the rule', () => {
    expect(trustProxyOf({ HUB_PUBLIC_URL: 'http://localhost:7300', TRUST_PROXY: 'uniquelocal' })).toBe(
      'uniquelocal',
    );
  });
});
