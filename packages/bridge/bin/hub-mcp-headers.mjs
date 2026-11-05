#!/usr/bin/env node
/**
 * @file The `headersHelper` Claude Code runs when it connects to Hub (docs/16 S1 Q9): it prints the Authorization header as JSON.
 * @description It reads a file, not a variable, because Claude Code removes credential-named variables for some scopes. It must always print clean JSON and finish fast, so anything wrong prints `{}`,
 * and Hub then answers 401, which `Settings › Devices` explains. It finds the file from its own location, so a changed `HOME` in a child process cannot point it elsewhere.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

let headers = {};
try {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
  const { credential } = JSON.parse(readFileSync(join(root, 'device.json'), 'utf8'));
  if (credential) headers = { Authorization: `Bearer ${credential}` };
} catch {
  headers = {};
}
process.stdout.write(JSON.stringify(headers));
