/**
 * @file Tailscale detection through a fake runner: absent, signed out, and serving Hub (docs/16 §10).
 */
import { type CommandRunner, tailscaleFacts } from './publishing.service';

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
