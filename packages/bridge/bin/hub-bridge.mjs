#!/usr/bin/env node
/**
 * @file `hub-bridge connect|run|status|health|uninstall`.
 * @description The command from Settings › Devices downloads this and runs `connect`. `run` is what starts at login. `--credentials-stdin` is for `pnpm start:local`: the credentials never appear in an argument.
 */
import { connect, connectionState, copyFromCheckout, status, uninstall } from '../lib/connect.mjs';
import { runChecks } from '../lib/health.mjs';
import { hubPaths, readJson } from '../lib/paths.mjs';
import { runBridge } from '../lib/service.mjs';
import { realSystem } from '../lib/system.mjs';

const USAGE = `Usage:
  hub-bridge connect --url <hub api url>
  hub-bridge run
  hub-bridge state --url <hub api url>
  hub-bridge status
  hub-bridge health
  hub-bridge uninstall`;

function option(args, name) {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? undefined : args[index + 1];
}

async function readStdin() {
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  return raw;
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  const system = realSystem();
  switch (command) {
    case 'connect': {
      const url = option(args, 'url');
      if (!url) throw new Error('Pass the Hub API address: connect --url <url>');
      const source = option(args, 'from-checkout');
      if (source) copyFromCheckout(system, source);
      const credentials = args.includes('--credentials-stdin') ? JSON.parse(await readStdin()) : undefined;
      await connect(system, { url, ...(credentials ? { credentials } : {}) });
      system.out('Done. Open Settings › Devices in Hub to see this device.');
      return;
    }
    case 'state': {
      const url = option(args, 'url');
      if (!url) throw new Error('Pass the Hub API address: state --url <url>');
      system.out(JSON.stringify(await connectionState(system, url)));
      return;
    }
    case 'run':
      process.exitCode = await runBridge(system);
      return;
    case 'status':
      system.out(JSON.stringify(await status(system), null, 2));
      return;
    case 'health': {
      const device = readJson(hubPaths(system).device);
      if (!device?.url) throw new Error('This device is not paired.');
      for (const check of await runChecks(system, device.url)) {
        const mark = check.level === 'ok' ? '✓' : check.level === 'warn' ? '!' : '✗';
        const extras = [check.detail, check.hint].filter(Boolean).join(' · ');
        system.out(`${mark} ${check.id}${extras ? `: ${extras}` : ''}`);
      }
      return;
    }
    case 'uninstall':
      await uninstall(system);
      return;
    default:
      system.out(USAGE);
      process.exitCode = command ? 1 : 0;
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
