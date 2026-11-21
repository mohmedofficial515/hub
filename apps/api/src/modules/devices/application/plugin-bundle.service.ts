/**
 * @file Where Hub's plugin lives on the main machine, and the bundle a device installs from it (docs/16 §11, D64).
 * @description The team pack in the checkout the API runs from, unless `HUB_TEAM_PACK_DIR` says otherwise (a test's temp copy). Hub's skills are its `plugin/skills` folders,
 * so the plugin a device installs, the files a new device downloads and the Skills page all read the same place. Nothing here holds a secret.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import { Inject, Injectable } from '@nestjs/common';

import { APP_CONFIG, type AppConfig } from '@/config/config.module';

import { type BundleFile, bundleOf, MARKETPLACE_FILE, type PluginBundle } from '../domain/plugin-bundle';

/** What of the team pack a device installs: the marketplace and the plugin. Tests and node_modules stay out. */
const PACK_ENTRIES = ['.claude-plugin', 'plugin'] as const;

export function repositoryRoot(): string {
  let folder = __dirname;
  for (;;) {
    if (existsSync(join(folder, 'pnpm-workspace.yaml'))) return folder;
    const parent = dirname(folder);
    if (parent === folder) throw new Error('Could not find the repository root for the bridge files');
    folder = parent;
  }
}

/** A file Hub is still writing, which no device should take half done. */
export const isHubTemp = (name: string): boolean => name.startsWith('.hub-');

export function walkText(path: string, name: string): BundleFile[] {
  if (statSync(path).isFile()) return [{ path: name, text: readFileSync(path, 'utf8') }];
  return readdirSync(path)
    .filter((entry) => !isHubTemp(entry))
    .flatMap((entry) => walkText(join(path, entry), `${name}/${entry}`));
}

@Injectable()
export class PluginBundleService {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  /** The team pack's folder. */
  get root(): string {
    return this.config.HUB_TEAM_PACK_DIR
      ? resolve(this.config.HUB_TEAM_PACK_DIR)
      : join(repositoryRoot(), 'packages', 'team-pack');
  }

  /** Hub's skills: one folder each, holding `SKILL.md`. */
  get skillsDir(): string {
    return join(this.root, 'plugin', 'skills');
  }

  /** The plugin as a device installs it now. Read on each call: a skill saved a moment ago counts. */
  current(): PluginBundle {
    const root = this.root;
    const raw = PACK_ENTRIES.flatMap((entry) => walkText(join(root, entry), entry));
    return bundleOf(raw, this.packageVersion(raw));
  }

  private packageVersion(raw: readonly BundleFile[]): string {
    try {
      const market = JSON.parse(raw.find((file) => file.path === MARKETPLACE_FILE)?.text ?? '{}') as {
        plugins?: { version?: string }[];
      };
      const version = market.plugins?.[0]?.version?.split('-')[0];
      return version && /^\d+\.\d+\.\d+$/.test(version) ? version : '0.1.0';
    } catch {
      return '0.1.0';
    }
  }
}
