/**
 * @file The files a new device downloads (docs/16 §5): the bridge, and the plugin's marketplace. They come from this Hub, so a new device needs only its URL.
 * @description They hold no secret, so they are served without sign-in. Tests and node_modules stay out.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { Injectable } from '@nestjs/common';

const PARTS: readonly (readonly [string, readonly string[]])[] = [
  ['bridge', ['bin', 'lib', 'package.json']],
  ['team-pack', ['.claude-plugin', 'plugin', 'package.json']],
];

export interface BundleFile {
  readonly path: string;
  readonly text: string;
}

function repositoryRoot(): string {
  let folder = __dirname;
  for (;;) {
    if (existsSync(join(folder, 'pnpm-workspace.yaml'))) return folder;
    const parent = dirname(folder);
    if (parent === folder) throw new Error('Could not find the repository root for the bridge files');
    folder = parent;
  }
}

function walk(path: string, name: string): BundleFile[] {
  if (statSync(path).isFile()) return [{ path: name, text: readFileSync(path, 'utf8') }];
  return readdirSync(path).flatMap((entry) => walk(join(path, entry), `${name}/${entry}`));
}

@Injectable()
export class ConnectBundleService {
  files(): BundleFile[] {
    const root = join(repositoryRoot(), 'packages');
    return PARTS.flatMap(([part, entries]) =>
      entries.flatMap((entry) => walk(join(root, part, entry), `${part}/${entry}`)),
    );
  }
}
