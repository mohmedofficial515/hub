import type { PublishingDto } from '@hub/contracts';
import { describe, expect, it } from 'vitest';

import { publishingProgress } from './publishing-steps';

const facts = (
  over: Partial<PublishingDto['tailscale']> = {},
  top: Partial<PublishingDto> = {},
): PublishingDto => ({
  publicUrl: 'http://localhost:7300',
  apiPublicUrl: null,
  secureCookies: false,
  bindHost: null,
  tailscale: {
    installed: false,
    running: false,
    dnsName: null,
    servesWeb: false,
    servesApi: false,
    matchesPublicUrl: false,
    ...over,
  },
  ...top,
});

describe('publishingProgress', () => {
  it('starts at installing Tailscale, with everything else later', () => {
    const progress = publishingProgress(facts(), false);
    expect(progress.summary).toBe('install');
    expect(progress.main).toEqual({
      install: 'next',
      https: 'later',
      serve: 'later',
      env: 'later',
      totp: 'later',
    });
    expect(progress.other).toEqual({ install: 'later', open: 'later', pair: 'later' });
  });

  it('installed but signed out is still the first step', () => {
    expect(publishingProgress(facts({ installed: true }), false).summary).toBe('install');
  });

  it('connected and not serving: the certificates, then the publish command', () => {
    const progress = publishingProgress(
      facts({ installed: true, running: true, dnsName: 'pc.t.ts.net' }),
      true,
    );
    expect(progress.summary).toBe('https');
    expect(progress.main.install).toBe('done');
    expect(progress.main.https).toBe('next');
    expect(progress.main.serve).toBe('later');
    expect(progress.main.totp).toBe('done');
  });

  it('serving with the old address: the .env lines and a restart', () => {
    const serving = {
      installed: true,
      running: true,
      dnsName: 'pc.t.ts.net',
      servesWeb: true,
      servesApi: true,
    };
    const progress = publishingProgress(facts(serving), false);
    expect(progress.summary).toBe('env');
    expect(progress.main.serve).toBe('done');
    expect(progress.main.env).toBe('next');
  });

  it('published: the other devices come next, and two-step sign-in if it is off', () => {
    const progress = publishingProgress(
      facts(
        {
          installed: true,
          running: true,
          dnsName: 'pc.t.ts.net',
          servesWeb: true,
          servesApi: true,
          matchesPublicUrl: true,
        },
        { publicUrl: 'https://pc.t.ts.net', secureCookies: true, bindHost: '127.0.0.1' },
      ),
      false,
    );
    expect(progress.summary).toBe('published');
    expect(progress.main.env).toBe('done');
    expect(progress.main.totp).toBe('next');
    expect(progress.other).toEqual({ install: 'next', open: 'later', pair: 'later' });
  });
});
