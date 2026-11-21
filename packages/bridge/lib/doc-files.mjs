/**
 * @file Reading and writing one document on the device that holds it (docs/16 §10), when the API cannot reach the source's folder itself.
 * @description Only under a root Hub registered as a docs source for this device, sent with the allowlist. The path must stay inside once links are resolved, and must be Markdown. A write states the version it was based on, and is refused
 * if the file has moved on since, which is checked here because this is where the file is. The write is atomic: a temp file beside it, then a rename.
 */
import { createHash, randomUUID } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';

import { Refusal } from './protocol.mjs';

const hashOf = (bytes) => createHash('sha256').update(bytes).digest('hex');
const unified = (path, platform) => {
  const plain = path.replaceAll('\\', '/').replace(/\/+$/, '');
  return platform === 'win32' ? plain.toLowerCase() : plain;
};

function target(args, context) {
  const { root, path } = args;
  if (typeof root !== 'string' || typeof path !== 'string') throw new Refusal('bad_arguments');
  const { platform } = context.system;
  const known = (context.docRoots?.() ?? []).some(
    (entry) => unified(entry, platform) === unified(root, platform),
  );
  if (!known) throw new Refusal('folder_not_allowed');
  if (path === '' || path.includes('\0') || isAbsolute(path) || !/\.mdx?$/i.test(path)) {
    throw new Refusal('bad_arguments');
  }
  if (path.replaceAll('\\', '/').split('/').includes('..')) throw new Refusal('folder_not_allowed');
  const file = resolve(root, path);
  if (relative(resolve(root), file).startsWith('..')) throw new Refusal('folder_not_allowed');
  if (existsSync(root)) {
    // The deepest folder that exists must still be inside once links are resolved.
    let folder = dirname(file);
    while (!existsSync(folder)) folder = dirname(folder);
    const inner = relative(realpathSync.native(root), realpathSync.native(folder));
    if (inner.startsWith('..') || isAbsolute(inner)) throw new Refusal('folder_not_allowed');
  } else {
    throw new Refusal('folder_missing');
  }
  return file;
}

export const docHandlers = {
  'doc.read': (args, context) => {
    const file = target(args, context);
    if (!existsSync(file)) return { exists: false, text: null, hash: null };
    const bytes = readFileSync(file);
    return { exists: true, text: bytes.toString('utf8'), hash: hashOf(bytes) };
  },
  'doc.write': (args, context) => {
    const file = target(args, context);
    if (typeof args.text !== 'string') throw new Refusal('bad_arguments');
    const current = existsSync(file) ? hashOf(readFileSync(file)) : null;
    if (current !== (args.baseHash ?? null)) return { outcome: 'stale', hash: current };
    mkdirSync(dirname(file), { recursive: true });
    const temp = join(dirname(file), `.hub-${randomUUID()}.tmp`);
    try {
      writeFileSync(temp, args.text);
      renameSync(temp, file);
    } finally {
      rmSync(temp, { force: true });
    }
    return { outcome: 'written', hash: hashOf(Buffer.from(args.text)) };
  },
};
