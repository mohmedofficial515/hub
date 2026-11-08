/**
 * @file `pnpm hub:tailscale [status|serve|reset]` (docs/16 §10, D43): publish Hub to your own devices over Tailscale, never to the internet.
 * @description `serve` points this machine's tailnet https address at Hub: `/` to the web, and `/mcp` and `/bridge` to the API, which another
 * device's Claude Code and bridge use (`/api/v1` already goes through the web). It is `tailscale serve`, so only devices signed in to your
 * tailnet reach it; `tailscale funnel` is never used. It then prints the two lines to put in `.env`, because Hub does not edit that file.
 * `reset` removes what `serve` set. Installing Tailscale and signing in is the owner's step on each device.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { readEnvFile, root } from './lib/hub-local.mjs';

const say = (text) => process.stdout.write(`${text}\n`);
const env = readEnvFile(join(root, '.env'));
const apiPort = Number(env.PORT || 7310);
const webPort = Number(process.env.HUB_WEB_PORT ?? 7300);

function binary() {
  const installed = join(process.env.ProgramFiles ?? 'C:\\Program Files', 'Tailscale', 'tailscale.exe');
  for (const candidate of ['tailscale', ...(existsSync(installed) ? [installed] : [])]) {
    const probe = spawnSync(candidate, ['version'], { encoding: 'utf8', shell: false, windowsHide: true });
    if (probe.status === 0) return candidate;
  }
  return null;
}

function run(tailscale, args) {
  return spawnSync(tailscale, args, { encoding: 'utf8', shell: false, windowsHide: true });
}

function dnsName(tailscale) {
  const status = run(tailscale, ['status', '--json']);
  try {
    const parsed = JSON.parse(status.stdout);
    return {
      running: parsed.BackendState === 'Running',
      name: String(parsed.Self?.DNSName ?? '').replace(/\.$/, '') || null,
    };
  } catch {
    return { running: false, name: null };
  }
}

function notInstalled() {
  say('Tailscale is not installed on this machine.');
  say('Install it from https://tailscale.com/download, sign in, then run `pnpm hub:tailscale serve` again.');
  say('The steps for each device are in docs/13-operations.md, "Other devices over Tailscale".');
  return 1;
}

function status(tailscale) {
  const { running, name } = dnsName(tailscale);
  if (!running) {
    say('Tailscale is installed but not connected: sign in with `tailscale up` or from its tray icon.');
    return 1;
  }
  say(`This machine on your tailnet: ${name}`);
  const serve = run(tailscale, ['serve', 'status']);
  say(serve.stdout.trim() || 'Nothing is served yet: run `pnpm hub:tailscale serve`.');
  const url = `https://${name}`;
  say(
    env.HUB_PUBLIC_URL === url
      ? `HUB_PUBLIC_URL is ${url}.`
      : `HUB_PUBLIC_URL is ${env.HUB_PUBLIC_URL || 'unset'}, not ${url}.`,
  );
  return 0;
}

function serve(tailscale) {
  const { running, name } = dnsName(tailscale);
  if (!running || !name) {
    say('Tailscale is installed but not connected: sign in first, then run this again.');
    return 1;
  }
  const steps = [
    ['serve', '--bg', '--https=443', `http://127.0.0.1:${webPort}`],
    ['serve', '--bg', '--https=443', '--set-path', '/mcp', `http://127.0.0.1:${apiPort}/mcp`],
    ['serve', '--bg', '--https=443', '--set-path', '/bridge', `http://127.0.0.1:${apiPort}/bridge`],
  ];
  for (const args of steps) {
    const result = run(tailscale, args);
    if (result.status !== 0) {
      say(`tailscale ${args.join(' ')} failed:\n${(result.stderr || result.stdout).trim()}`);
      say(
        'If it asks you to enable HTTPS for your tailnet, do that in the Tailscale admin console (DNS › HTTPS Certificates) and run this again.',
      );
      return 1;
    }
  }
  const url = `https://${name}`;
  say(`Hub is served at ${url} to the devices on your tailnet only.`);
  say('');
  say(
    'Put these two lines in .env, then restart Hub (`pnpm stop:local` and `pnpm start:local`, or `pnpm hub:service stop` and `start`):',
  );
  say(`  HUB_PUBLIC_URL=${url}`);
  say(`  HUB_API_PUBLIC_URL=${url}`);
  say('');
  say(
    'Hub then sets Secure cookies and listens on 127.0.0.1 only, so this address is the one way in from another device.',
  );
  say('Turn on two-step sign-in (TOTP) in your profile before using Hub from another device (docs/16 §13).');
  return 0;
}

function reset(tailscale) {
  const result = run(tailscale, ['serve', 'reset']);
  say(
    result.status === 0
      ? 'Tailscale no longer serves anything from this machine.'
      : (result.stderr || result.stdout).trim(),
  );
  say('Put HUB_PUBLIC_URL back to http://localhost:7300 in .env and restart Hub.');
  return result.status === 0 ? 0 : 1;
}

const command = process.argv[2] ?? 'status';
const tailscale = binary();
if (!['status', 'serve', 'reset'].includes(command)) {
  say('Usage: pnpm hub:tailscale [status | serve | reset]');
  process.exitCode = 1;
} else if (!tailscale) {
  process.exitCode = notInstalled();
} else {
  process.exitCode =
    command === 'serve' ? serve(tailscale) : command === 'reset' ? reset(tailscale) : status(tailscale);
}
