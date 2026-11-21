#!/usr/bin/env node
/**
 * @file `npx @hub/team-pack init|doctor|uninstall|link <slug>`.
 * @description The token comes from `--token` or from `HUB_PACK_TOKEN`, and is never printed.
 */
import { doctor, init, link, realSystem, uninstall } from '../lib/commands.mjs';

const USAGE = `Usage:
  hub-team-pack init [--url http://localhost:7310] --token hub_…
  hub-team-pack doctor [--flush]
  hub-team-pack link <slug>
  hub-team-pack uninstall`;

function option(args, name) {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? undefined : args[index + 1];
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  const system = realSystem();
  switch (command) {
    case 'init':
      await init(system, {
        url: option(args, 'url'),
        token: option(args, 'token') ?? process.env.HUB_PACK_TOKEN,
      });
      return;
    case 'doctor':
      if (!(await doctor(system, { flush: args.includes('--flush') }))) process.exitCode = 1;
      return;
    case 'link':
      await link(system, { slug: args[0], cwd: process.cwd() });
      return;
    case 'uninstall':
      uninstall(system);
      return;
    default:
      process.stdout.write(`${USAGE}\n`);
      process.exitCode = command ? 1 : 0;
  }
}

main().catch((error) => {
  process.stderr.write(`✗ ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
