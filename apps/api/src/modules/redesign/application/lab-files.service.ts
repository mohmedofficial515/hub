/**
 * @file The lab folder on disk (docs/15 §3): where it is, safe reads, and writing a version's status.
 * @description The root is the project's `local_path` source of purpose `lab`, and must lie inside `LAB_ROOT` when that
 * is set. Every path from a request passes `resolveInside`: no absolute path, no `..`, no backslash, and the real path
 * after links must still be inside the root. Only image types are served. `redesign/` is not a Git repository, so a write
 * is a write: no commit (docs/15 §3).
 */
import { createHash } from 'node:crypto';
import { readFile, realpath, stat, writeFile } from 'node:fs/promises';
import { extname, isAbsolute, join, relative, resolve, sep } from 'node:path';

import { Inject, Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';

import { APP_CONFIG, type AppConfig } from '@/config/config.module';
import { type PrismaTransactionalAdapter } from '@/infra/prisma/prisma.module';
import { AppException } from '@/shared/errors';

export const IMAGE_TYPES: Readonly<Record<string, string>> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

export const sha256 = (text: string | Buffer): string => createHash('sha256').update(text).digest('hex');

const isInside = (root: string, path: string): boolean => {
  const inner = relative(root, path);
  return inner !== '' && !inner.startsWith('..') && !isAbsolute(inner);
};

export function isSafeRelativePath(path: string): boolean {
  if (!path || path.includes('\0') || path.includes('\\') || isAbsolute(path) || /^[a-zA-Z]:/.test(path)) {
    return false;
  }
  return path.split('/').every((segment) => segment !== '..' && segment !== '.' && segment !== '');
}

export interface LabLocation {
  readonly sourceId: string;
  readonly sourceName: string;
  readonly root: string;
}

@Injectable()
export class LabFilesService {
  constructor(
    private readonly txHost: TransactionHost<PrismaTransactionalAdapter>,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  get labUrl(): string | null {
    return this.config.LAB_URL?.replace(/\/$/, '') ?? null;
  }

  /** Null when the project has no lab: an honest empty state, not an error. */
  async locate(workspaceId: string): Promise<LabLocation | null> {
    const sources = await this.txHost.tx.source.findMany({
      where: { workspaceId, kind: 'local_path', enabled: true },
      select: { id: true, name: true, config: true },
    });
    const lab = sources.find((source) => (source.config as { purpose?: string }).purpose === 'lab');
    if (!lab) return null;
    const root = resolve((lab.config as { path: string }).path);
    const allowed = this.config.LAB_ROOT ? resolve(this.config.LAB_ROOT) : null;
    if (allowed && root !== allowed && !isInside(allowed, root)) {
      throw new AppException('hub.redesign.lab_unavailable', { details: { reason: 'outside_lab_root' } });
    }
    return { sourceId: lab.id, sourceName: lab.name, root };
  }

  /** The file under the root, or null if the path tries to leave it. */
  private async resolveInside(root: string, path: string): Promise<string | null> {
    if (!isSafeRelativePath(path)) return null;
    const joined = join(root, ...path.split('/'));
    if (!isInside(root, joined)) return null;
    try {
      const [realRoot, real] = await Promise.all([realpath(root), realpath(joined)]);
      return real.startsWith(realRoot + sep) ? real : null;
    } catch {
      return null;
    }
  }

  /** An image under the lab, for `GET /lab/file`. Anything else is simply not found. */
  async image(
    workspaceId: string,
    path: string,
  ): Promise<{ absolute: string; type: string; size: number } | null> {
    const lab = await this.locate(workspaceId);
    const type = IMAGE_TYPES[extname(path).toLowerCase()];
    if (!lab || !type) return null;
    const absolute = await this.resolveInside(lab.root, path);
    if (!absolute) return null;
    const info = await stat(absolute);
    return info.isFile() ? { absolute, type, size: info.size } : null;
  }

  async readText(workspaceId: string, path: string): Promise<string | null> {
    const lab = await this.locate(workspaceId);
    if (!lab) return null;
    const absolute = await this.resolveInside(lab.root, path);
    return absolute ? readFile(absolute, 'utf8') : null;
  }

  /**
   * Rewrites a version's README through `edit`. Null when the project has no lab, so a card from elsewhere still moves;
   * a lab that cannot be written refuses the action, so the card never holds a status the file does not (docs/10 §5).
   */
  async editReadme(
    workspaceId: string,
    labPath: string,
    edit: (raw: string) => string,
  ): Promise<{ readmeHash: string; raw: string } | null> {
    const lab = await this.locate(workspaceId);
    if (!lab) return null;
    const absolute = await this.resolveInside(lab.root, `${labPath}/README.md`);
    if (!absolute) {
      throw new AppException('hub.redesign.lab_unavailable', { details: { reason: 'version_not_found' } });
    }
    try {
      const raw = edit(await readFile(absolute, 'utf8'));
      await writeFile(absolute, raw, 'utf8');
      return { readmeHash: sha256(raw), raw };
    } catch (cause) {
      throw new AppException('hub.redesign.write_failed', { cause });
    }
  }
}
