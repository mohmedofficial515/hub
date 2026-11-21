/**
 * @file Where the API listens (docs/16 §10, D43). Published through `tailscale serve`, Hub answers on 127.0.0.1 only, so the tailnet's
 * https address is the one way in from another device. Before that, nothing changes: every interface, as the first release ran.
 */
export interface BindConfig {
  readonly HUB_PUBLIC_URL: string;
  readonly HUB_BIND_HOST?: string | undefined;
}

/** `HUB_BIND_HOST` when set, else 127.0.0.1 for an https public URL, else undefined (every interface). */
export function bindHostOf(config: BindConfig): string | undefined {
  if (config.HUB_BIND_HOST) return config.HUB_BIND_HOST;
  return config.HUB_PUBLIC_URL.startsWith('https://') ? '127.0.0.1' : undefined;
}

export interface TrustConfig extends BindConfig {
  readonly TRUST_PROXY?: string | undefined;
}

/**
 * Express `trust proxy`. `TRUST_PROXY` when set; else `loopback` when the API listens on a loopback address only, because then every
 * connection is a proxy on this machine (the web's, or `tailscale serve`), and without it every device would share the proxy's address:
 * one sign-in limit and one lockout for the owner and a friend alike. Else nothing is trusted.
 */
export function trustProxyOf(config: TrustConfig): string | undefined {
  if (config.TRUST_PROXY) return config.TRUST_PROXY;
  const host = bindHostOf(config);
  return host === '127.0.0.1' || host === '::1' || host === 'localhost' ? 'loopback' : undefined;
}
