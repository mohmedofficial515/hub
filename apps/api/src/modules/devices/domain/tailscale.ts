/**
 * @file What `tailscale status --json` and `tailscale serve status --json` say about publishing Hub (docs/16 §10, D43). Pure, so the
 * reading has its own test; the service runs the two commands.
 * @description Hub is published when the tailnet address serves https `/` from Hub's web, and `/mcp` and `/bridge` from Hub's API, which
 * another device's Claude Code and bridge use. Anything else on that address is left alone.
 */
export interface TailscaleFacts {
  readonly installed: boolean;
  readonly running: boolean;
  readonly dnsName: string | null;
  readonly servesWeb: boolean;
  readonly servesApi: boolean;
  readonly matchesPublicUrl: boolean;
}

export const NO_TAILSCALE: TailscaleFacts = {
  installed: false,
  running: false,
  dnsName: null,
  servesWeb: false,
  servesApi: false,
  matchesPublicUrl: false,
};

function parse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Signed in and connected, and this machine's tailnet name without its trailing dot. */
export function readStatus(text: string): { running: boolean; dnsName: string | null } {
  const status = parse(text);
  if (!isRecord(status)) return { running: false, dnsName: null };
  const self = isRecord(status['Self']) ? status['Self'] : {};
  const dns = typeof self['DNSName'] === 'string' ? self['DNSName'].replace(/\.$/, '') : '';
  return { running: status['BackendState'] === 'Running', dnsName: dns || null };
}

/** The port of a proxy target on this machine, or null for anything else. */
function localPort(target: unknown): number | null {
  if (typeof target !== 'string') return null;
  try {
    const url = new URL(target);
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) return null;
    return Number(url.port || (url.protocol === 'https:' ? 443 : 80));
  } catch {
    return null;
  }
}

/** Which of Hub's paths the https address on `dnsName` serves, given the API's port. */
export function readServe(
  text: string,
  dnsName: string | null,
  apiPort: number,
): { servesWeb: boolean; servesApi: boolean } {
  const serve = parse(text);
  const web = isRecord(serve) && isRecord(serve['Web']) ? serve['Web'] : {};
  const site = Object.entries(web).find(([host]) => !dnsName || host.split(':')[0] === dnsName)?.[1];
  const handlers = isRecord(site) && isRecord(site['Handlers']) ? site['Handlers'] : {};
  const portOf = (path: string): number | null => {
    const handler = handlers[path];
    return isRecord(handler) ? localPort(handler['Proxy']) : null;
  };
  const root = portOf('/');
  return {
    servesWeb: root !== null && root !== apiPort,
    servesApi: portOf('/mcp') === apiPort && portOf('/bridge') === apiPort,
  };
}

/** HUB_PUBLIC_URL is the tailnet's https address. */
export function matchesPublicUrl(publicUrl: string, dnsName: string | null): boolean {
  if (!dnsName) return false;
  try {
    const url = new URL(publicUrl);
    return url.protocol === 'https:' && url.hostname === dnsName;
  } catch {
    return false;
  }
}
