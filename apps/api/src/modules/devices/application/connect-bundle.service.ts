/**
 * @file The files a new device downloads (docs/16 §5): the bridge, and the plugin's marketplace. They come from this Hub, so a new device needs only its URL.
 * @description They hold no secret, so they are served without sign-in. Tests and node_modules stay out. The plugin's part is the same bundle the sync sends (docs/16 §11),
 * so a new device starts with Hub's skills and the version the others have.
 */
import { join } from 'node:path';

import { Injectable } from '@nestjs/common';

import type { BundleFile } from '../domain/plugin-bundle';
import { PluginBundleService, repositoryRoot, walkText } from './plugin-bundle.service';

const BRIDGE_ENTRIES = ['bin', 'lib', 'package.json'] as const;

export type { BundleFile };

@Injectable()
export class ConnectBundleService {
  constructor(private readonly plugin: PluginBundleService) {}

  files(): BundleFile[] {
    const bridge = join(repositoryRoot(), 'packages', 'bridge');
    const plugin = this.plugin
      .current()
      .files.map((file) => ({ path: `team-pack/${file.path}`, text: file.text }));
    const packageJson = walkText(join(this.plugin.root, 'package.json'), 'team-pack/package.json');
    return [
      ...BRIDGE_ENTRIES.flatMap((entry) => walkText(join(bridge, entry), `bridge/${entry}`)),
      ...plugin,
      ...packageJson,
    ];
  }
}
