/**
 * @file Tailscale detection through a fake runner: absent, signed out, and serving Hub (docs/16 §10).
 */
import type { AppConfig } from '@/config/config.module';

import { type CommandRunner, PublishingService, tailscaleFacts } from './publishing.service';

const DNS = 'main-pc.tail1234.ts.net';

function runner(
  answers: Record<string, { status: number; stdout: string }>,
): CommandRunner & { calls: string[] } {
  const calls: string[] = [];
  const run = (async (command: string, args: readonly string[]) => {
    const line = `${command} ${args.join(' ')}`;
    calls.push(line);
    return answers[line] ?? { status: 127, stdout: '' };
  }) as CommandRunner & { calls: string[] };
  run.calls = calls;
  return run;
}

describe('tailscaleFacts', () => {
  it('says not installed when no candidate runs, with no error', async () => {
    const run = runner({});
    const facts = await tailscaleFacts(
      run,
      ['tailscale', 'C:\Program Files\Tailscale\tailscale.exe'],
      'http://localhost:7300',
      7310,
    );
    expect(facts.installed).toBe(false);
    expect(run.calls).toHaveLength(2);
  });

  it('is installed but not running when signed out, and never asks serve', async () => {
    const run = runner({
      'tailscale status --json': { status: 1, stdout: JSON.stringify({ BackendState: 'NeedsLogin' }) },
    });
    const facts = await tailscaleFacts(run, ['tailscale'], 'http://localhost:7300', 7310);
    expect(facts).toMatchObject({ installed: true, running: false, servesWeb: false });
    expect(run.calls).toEqual(['tailscale status --json']);
  });

  it('sees Hub served at the address HUB_PUBLIC_URL names', async () => {
    const run = runner({
      'tailscale status --json': {
        status: 0,
        stdout: JSON.stringify({ BackendState: 'Running', Self: { DNSName: `${DNS}.` } }),
      },
      'tailscale serve status --json': {
        status: 0,
        stdout: JSON.stringify({
          Web: {
            [`${DNS}:443`]: {
              Handlers: {
                '/': { Proxy: 'http://127.0.0.1:7300' },
                '/mcp': { Proxy: 'http://127.0.0.1:7310/mcp' },
                '/bridge': { Proxy: 'http://127.0.0.1:7310/bridge' },
              },
            },
          },
        }),
      },
    });
    expect(await tailscaleFacts(run, ['tailscale'], `https://${DNS}`, 7310)).toEqual({
      installed: true,
      running: true,
      dnsName: DNS,
      servesWeb: true,
      servesApi: true,
      matchesPublicUrl: true,
    });
  });
});

describe('PublishingService', () => {
  it('keeps the answer 30 s, and a fresh check reads Tailscale again, at most once in 3 s', async () => {
    jest.useFakeTimers({ now: new Date('2026-11-08T10:00:00Z') });
    try {
      const service = new PublishingService({
        HUB_PUBLIC_URL: 'http://localhost:7300',
        PORT: 7310,
      } as unknown as AppConfig);
      const run = runner({});
      service.run = run;
      await service.status();
      const once = run.calls.length;
      await service.status();
      expect(run.calls.length).toBe(once);
      await service.status({ fresh: true });
      expect(run.calls.length).toBe(once);
      jest.advanceTimersByTime(3_500);
      await service.status({ fresh: true });
      expect(run.calls.length).toBe(once * 2);
    } finally {
      jest.useRealTimers();
    }
  });
});
