/**
 * @file PostToolUse on `log_session`: notes that a summary was written, so the exit report says so.
 */
import { fail, readJson, readStdin, sessionFile, writeJson } from './lib.mjs';

try {
  const input = await readStdin();
  if (input.session_id) {
    const path = sessionFile(input.session_id);
    writeJson(path, { ...(readJson(path) ?? {}), summaryLogged: true });
  }
} catch (error) {
  fail(error);
}
