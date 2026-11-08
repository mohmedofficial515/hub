/**
 * @file Reading a project's Prisma schema on the device that holds it (docs/17 §2), when the API cannot reach the folder itself.
 * @description Read only. The `folder` is checked against the allowlist by the dispatcher, as for every folder action. `schemaDir` must be a relative folder inside it, and must stay inside once links are
 * resolved. Only `.prisma` files directly in that folder are read, or the one file when `schemaDir` names a `.prisma` file, so nothing else on the machine can be reached through this action.
 */
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';

import { Refusal } from './protocol.mjs';

const MAX_FILES = 200;
const MAX_BYTES = 4 * 1024 * 1024;

const hashOf = (bytes) => createHash('sha256').update(bytes).digest('hex');

function schemaTarget(args) {
  const { folder, schemaDir } = args;
  if (typeof folder !== 'string' || typeof schemaDir !== 'string') throw new Refusal('bad_arguments');
  if (schemaDir === '' || schemaDir.includes('\0') || isAbsolute(schemaDir))
    throw new Refusal('bad_arguments');
  if (schemaDir.replaceAll('\\', '/').split('/').includes('..')) throw new Refusal('folder_not_allowed');
  if (!existsSync(folder)) throw new Refusal('folder_missing');
  const target = resolve(folder, schemaDir);
  if (!existsSync(target)) throw new Refusal('folder_missing');
  const inner = relative(realpathSync.native(folder), realpathSync.native(target));
  if (inner.startsWith('..') || isAbsolute(inner)) throw new Refusal('folder_not_allowed');
  return target;
}

export function readSchemaFiles(args) {
  const target = schemaTarget(args);
  const single = statSync(target).isFile();
  if (single && !/\.prisma$/i.test(target)) throw new Refusal('bad_arguments');
  const names = single
    ? [target]
    : readdirSync(target)
        .filter((name) => /\.prisma$/i.test(name))
        .sort()
        .map((name) => join(target, name))
        .filter((file) => statSync(file).isFile());
  if (names.length > MAX_FILES) throw new Refusal('bad_arguments');
  let total = 0;
  const files = names.map((file) => {
    const bytes = readFileSync(file);
    total += bytes.length;
    if (total > MAX_BYTES) throw new Refusal('bad_arguments');
    return {
      path: relative(resolve(args.folder), file).replaceAll('\\', '/'),
      text: bytes.toString('utf8'),
      hash: hashOf(bytes),
    };
  });
  const hash = hashOf(files.map((file) => `${file.path}:${file.hash}`).join('\n'));
  return { files, hash };
}

export const schemaHandlers = {
  'schema.read': (args) => readSchemaFiles(args),
};
