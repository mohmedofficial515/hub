/**
 * @file The two skill folders on the main machine (docs/16 §11, D64): Hub's, which the plugin carries, and the owner's personal one, which Hub only reads.
 * @description A skill is a folder holding `SKILL.md`. Paths come from the config, so a test points both at temp folders. Hub writes only inside its own folder, a file at a time
 * through a temp name and a rename, and never follows a link out of it. The personal folder is read for its listing and for Move to Hub, and nothing there is ever written.
 */
import { randomUUID } from 'node:crypto';
import { existsSync, lstatSync, readdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';

import { SKILL_LIMITS } from '@hub/contracts';
import { Inject, Injectable } from '@nestjs/common';

import { APP_CONFIG, type AppConfig } from '@/config/config.module';
import { type BundleFile, isHubTemp, PluginBundleService } from '@/modules/devices';
import { AppException } from '@/shared/errors';

export interface FolderFile {
  /** Relative to the skill's folder, with forward slashes. */
  readonly path: string;
  readonly bytes: Buffer;
}

export interface SkillFolder {
  readonly name: string;
  readonly files: readonly FolderFile[];
  readonly updatedAt: Date | null;
}

/** Text as a skill holds it: UTF-8 with no NUL byte. Anything else is not copied into Hub. */
export function asText(bytes: Buffer): string | null {
  if (bytes.includes(0)) return null;
  const text = bytes.toString('utf8');
  return Buffer.from(text, 'utf8').equals(bytes) ? text : null;
}

export const toBundle = (files: readonly FolderFile[]): BundleFile[] =>
  files.map((file) => ({ path: file.path, text: file.bytes.toString('utf8') }));

/** Dot entries (`.git`, `.DS_Store`) and Hub's own temp files are not part of a skill. */
const skipped = (name: string): boolean => name.startsWith('.') || isHubTemp(name);

@Injectable()
export class SkillFolders {
  constructor(
    private readonly bundle: PluginBundleService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  get hubRoot(): string {
    return this.bundle.skillsDir;
  }

  get personalRoot(): string {
    if (this.config.HUB_PERSONAL_SKILLS_DIR) return resolve(this.config.HUB_PERSONAL_SKILLS_DIR);
    const claude = this.config.CLAUDE_CONFIG_DIR ?? join(homedir(), '.claude');
    return join(claude, 'skills');
  }

  /** Every folder holding `SKILL.md`, by name. A folder that is not there lists nothing. */
  names(root: string): string[] {
    if (!existsSync(root)) return [];
    return readdirSync(root, { withFileTypes: true })
      .filter((entry) => !skipped(entry.name) && (entry.isDirectory() || entry.isSymbolicLink()))
      .filter((entry) => existsSync(join(root, entry.name, 'SKILL.md')))
      .map((entry) => entry.name)
      .sort();
  }

  /** One skill's files. With `limits`, a folder too big to copy is refused before anything is read in full. */
  read(root: string, name: string, limits = false): SkillFolder {
    const folder = join(root, name);
    if (!existsSync(join(folder, 'SKILL.md'))) {
      throw new AppException(
        root === this.hubRoot ? 'hub.skills.not_found' : 'hub.skills.personal_not_found',
      );
    }
    const files: FolderFile[] = [];
    let total = 0;
    let newest = 0;
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (skipped(entry.name)) continue;
        const full = join(dir, entry.name);
        const stat = statSync(full);
        if (stat.isDirectory()) {
          walk(full);
          continue;
        }
        if (!stat.isFile()) continue;
        if (limits) {
          total += stat.size;
          if (
            files.length >= SKILL_LIMITS.files ||
            stat.size > SKILL_LIMITS.fileBytes ||
            total > SKILL_LIMITS.totalBytes
          ) {
            throw new AppException('hub.skills.too_large', {
              params: { files: SKILL_LIMITS.files, megabytes: SKILL_LIMITS.totalBytes / 1_000_000 },
            });
          }
        }
        newest = Math.max(newest, stat.mtimeMs);
        files.push({ path: relative(folder, full).split(sep).join('/'), bytes: readFileSync(full) });
      }
    };
    walk(folder);
    return { name, files, updatedAt: newest ? new Date(newest) : null };
  }

  async readSkillMd(name: string): Promise<string> {
    return readFile(this.inHub(name, 'SKILL.md'), 'utf8');
  }

  /** Writes one file of a Hub skill, whole or not at all. */
  async writeFile(name: string, path: string, text: string): Promise<void> {
    const file = this.inHub(name, path);
    await mkdir(dirname(file), { recursive: true });
    const temp = join(dirname(file), `.hub-${randomUUID()}.tmp`);
    try {
      await writeFile(temp, text);
      await rename(temp, file);
    } finally {
      await rm(temp, { force: true });
    }
  }

  /**
   * A new Hub skill from whole files: written into a temp folder beside the others, then renamed into place, so a device never takes half of it.
   * A name that exists by the time of the rename is refused.
   */
  async createFolder(name: string, files: readonly { path: string; text: string }[]): Promise<void> {
    const root = this.hubRoot;
    if (!existsSync(root)) throw new AppException('hub.skills.unavailable');
    const target = join(root, name);
    if (existsSync(target)) throw new AppException('hub.skills.name_taken', { params: { name } });
    const temp = join(root, `.hub-${randomUUID()}`);
    try {
      for (const file of files) {
        const path = resolve(temp, file.path);
        if (!path.startsWith(temp + sep)) throw new AppException('hub.common.validation');
        await mkdir(dirname(path), { recursive: true });
        await writeFile(path, file.text);
      }
      if (existsSync(target)) throw new AppException('hub.skills.name_taken', { params: { name } });
      await rename(temp, target);
    } finally {
      await rm(temp, { recursive: true, force: true });
    }
  }

  /** A path inside one Hub skill's folder, with links resolved: nothing can lead out of Hub's folder. */
  private inHub(name: string, path: string): string {
    const root = this.hubRoot;
    if (!existsSync(root)) throw new AppException('hub.skills.unavailable');
    const folder = join(root, name);
    const file = resolve(folder, path);
    if (!file.startsWith(folder + sep)) throw new AppException('hub.common.validation');
    if (existsSync(folder)) {
      const real = realpathSync.native(folder);
      const realRoot = realpathSync.native(root);
      if (lstatSync(folder).isSymbolicLink() || !real.startsWith(realRoot + sep)) {
        throw new AppException('hub.skills.unavailable');
      }
    }
    return file;
  }
}
