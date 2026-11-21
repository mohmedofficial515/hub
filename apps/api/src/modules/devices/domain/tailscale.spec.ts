/**
 * @file Reading Tailscale's answers: signed in or not, the tailnet name, and whether Hub's paths are served (docs/16 §10).
 */
import { matchesPublicUrl, readServe, readStatus } from './tailscale';

const DNS = 'main-pc.tail1234.ts.net';
const serving = (handlers: Record<string, { Proxy: string }>) =>
  JSON.stringify({ TCP: { '443': { HTTPS: true } }, Web: { [`${DNS}:443`]: { Handlers: handlers } } });

describe('readStatus', () => {
  it('reads a running node and drops the trailing dot of its name', () => {
    expect(readStatus(JSON.stringify({ BackendState: 'Running', Self: { DNSName: `${DNS}.` } }))).toEqual({
      running: true,
      dnsName: DNS,
    });
  });

  it('is not running when signed out or when the answer is not JSON', () => {
    expect(readStatus(JSON.stringify({ BackendState: 'NeedsLogin', Self: {} }))).toEqual({
      running: false,
      dnsName: null,
    });
    expect(readStatus('failed to connect to local tailscaled')).toEqual({ running: false, dnsName: null });
  });
});

describe('readServe', () => {
  it('sees the web at / and the API at /mcp and /bridge', () => {
    const text = serving({
      '/': { Proxy: 'http://127.0.0.1:7300' },
      '/mcp': { Proxy: 'http://127.0.0.1:7310/mcp' },
      '/bridge': { Proxy: 'http://127.0.0.1:7310/bridge' },
    });
    expect(readServe(text, DNS, 7310)).toEqual({ servesWeb: true, servesApi: true });
  });

  it('says the API is missing when only the web is served', () => {
    expect(readServe(serving({ '/': { Proxy: 'http://localhost:7300' } }), DNS, 7310)).toEqual({
      servesWeb: true,
      servesApi: false,
    });
  });

  it('ignores a proxy to another machine, and an empty or missing config', () => {
    expect(readServe(serving({ '/': { Proxy: 'http://10.0.0.5:7300' } }), DNS, 7310).servesWeb).toBe(false);
    expect(readServe('{}', DNS, 7310)).toEqual({ servesWeb: false, servesApi: false });
    expect(readServe('', DNS, 7310)).toEqual({ servesWeb: false, servesApi: false });
  });
});

describe('matchesPublicUrl', () => {
  it('wants https on the tailnet name', () => {
    expect(matchesPublicUrl(`https://${DNS}`, DNS)).toBe(true);
    expect(matchesPublicUrl('http://localhost:7300', DNS)).toBe(false);
    expect(matchesPublicUrl(`http://${DNS}`, DNS)).toBe(false);
    expect(matchesPublicUrl(`https://${DNS}`, null)).toBe(false);
  });
});
