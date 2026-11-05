/**
 * @file The detached sender: posts one outbox file, with three attempts, and removes it on success.
 * @description On failure the file stays, and the next SessionStart or `doctor --flush` tries again.
 */
import { rmSync } from 'node:fs';

import { fail, headersFor, loadConfig, readJson } from './lib.mjs';

const TIMEOUT_MS = 10_000;
const BACKOFF_MS = [0, 2000, 5000];

export async function send(file) {
  const entry = readJson(file);
  if (!entry) return false;
  const config = loadConfig();
  if (!config.token) return false;
  for (const wait of BACKOFF_MS) {
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    try {
      const response = await fetch(`${config.url}/api/v1/capture/session`, {
        method: 'POST',
        headers: headersFor(config, entry.project),
        body: JSON.stringify(entry.payload),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (response.ok) {
        rmSync(file, { force: true });
        return true;
      }
      // Hub refused this report for good, such as a secret in a commit message. Retrying cannot help.
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        rmSync(file, { force: true });
        process.stderr.write(`hub hook: Hub refused the session report (${response.status})\n`);
        return false;
      }
    } catch {
      // Try again.
    }
  }
  return false;
}

const file = process.argv[2];
if (file) await send(file).catch(fail);
