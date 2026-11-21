/**
 * @file Reads a source's `.prisma` files (docs/17 §2): from disk when the folder is on the API's machine, else from its device through the bridge's read-only `schema.read`.
 * @description The same rule as the bridge, kept here for the local read: a relative folder inside the repository, links resolved, `.prisma` files only, directly in that folder. The hash covers every file's path and bytes, so it changes exactly when the design's text does.
 */
import { createHash } from 'node:crypto';
import { existsSync, realpathSync, statSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';

import { Injectable } from '@nestjs/common';

import { BridgeHub } from '@/modules/devices';
import { AppException } from '@/shared/errors';

import type { SchemaFile } from '../domain/prisma-parse';

const BRIDGE_TIMEOUT_MS = 30_000;
const MAX_FILES = 200;
const MAX_BYTES = 4 * 1024 * 1024;

const hashOf = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');

export interface SourceLocation {
  readonly path: string;
  readonly schemaDir: string;
  readonly deviceId: string | null;
}

export interface ReadSchema {
  readonly files: (SchemaFile & { readonly hash: string })[];
  readonly hash: string;
}

export const combinedHash = (files: readonly { path: string; hash: string }[]): string =>
  hashOf(files.map((file) => `${file.path}:${file.hash}`).join('\n'));

@Injectable()
export class SchemaReader {
  constructor(private readonly hub: BridgeHub) {}

  async read(source: SourceLocation): Promise<ReadSchema> {
    if (source.deviceId) {
      if (!this.hub.isOnline(source.deviceId)) throw new AppException('hub.devices.offline');
      const answer = await this.hub.request<ReadSchema>(
        source.deviceId,
        'schema.read',
        { folder: source.path, schemaDir: source.schemaDir },
        { timeoutMs: BRIDGE_TIMEOUT_MS },
      );
      return { files: answer.files, hash: combinedHash(answer.files) };
    }
    return this.readLocal(source);
  }

  private async readLocal(source: SourceLocation): Promise<ReadSchema> {
    const dir = source.schemaDir;
    if (isAbsolute(dir) || dir.replaceAll('\\', '/').split('/').includes('..')) {
      throw new AppException('hub.schema.folder_not_allowed');
    }
    const target = resolve(source.path, dir);
    if (!existsSync(source.path) || !existsSync(target)) throw new AppException('hub.schema.unreadable');
    const inner = relative(realpathSync.native(source.path), realpathSync.native(target));
    if (inner.startsWith('..') || isAbsolute(inner)) throw new AppException('hub.schema.folder_not_allowed');

    const single = statSync(target).isFile();
    if (single && !/\.prisma$/i.test(target)) throw new AppException('hub.schema.unreadable');
    const paths = single
      ? [target]
      : (await readdir(target, { withFileTypes: true }))
          .filter((entry) => entry.isFile() && /\.prisma$/i.test(entry.name))
          .map((entry) => join(target, entry.name))
          .sort();
    if (paths.length === 0 || paths.length > MAX_FILES) throw new AppException('hub.schema.unreadable');
    let total = 0;
    const files = await Promise.all(
      paths.map(async (file) => {
        const bytes = await readFile(file);
        total += bytes.length;
        return {
          path: relative(resolve(source.path), file).replaceAll('\\', '/'),
          text: bytes.toString('utf8'),
          hash: hashOf(bytes),
        };
      }),
    );
    if (total > MAX_BYTES) throw new AppException('hub.schema.unreadable');
    return { files, hash: combinedHash(files) };
  }
}
