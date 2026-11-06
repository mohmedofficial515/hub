/**
 * @file The lab's dev server: Hub's proxy reaches it at `/lab` (docs/16 §6), on this machine only.
 * @description Versions import the real projects through `@web/*` and `@dash/*`, found by `LAB_WEB_SRC` and `LAB_DASH_SRC`, by default the
 * sibling folders of the Hub checkout. The lab only reads them. `server.fs.allow` names what a request may read: the lab, the two `src` trees, and the
 * packages they load. Nothing else of Hub or the sibling projects is reachable through `/lab/@fs`.
 */
import { existsSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

const ROOT = realpathSync(path.dirname(fileURLToPath(import.meta.url)));
const WEB_SRC = path.resolve(ROOT, process.env.LAB_WEB_SRC ?? '../../../web/src');
const DASH_SRC = path.resolve(ROOT, process.env.LAB_DASH_SRC ?? '../../../Goteav-Dashboard/src');
const PORT = Number(process.env.LAB_PORT ?? 7320);

const norm = (p: string) => path.normalize(p.split('?')[0]).toLowerCase();
const slashes = (p: string) => p.replaceAll('\\', '/');

/** The pnpm store holding this package's dependencies, without the rest of the workspace around it. */
function packageStore(): string {
  return path.resolve(realpathSync(path.join(ROOT, 'node_modules/react')), '../../..');
}

/** What the lab may serve. A project that is not on this machine is left out, and only its own frames fail. */
function allowedRoots(): string[] {
  const projects = [WEB_SRC, DASH_SRC].flatMap((src) => [src, path.resolve(src, '../node_modules')]);
  return [ROOT, packageStore(), ...projects.filter((dir) => existsSync(dir))];
}

/** `web.css` and `dashboard.css` import the live tokens. CSS has no environment, so their folders are filled in here, before Tailwind reads them. */
function projectCss(): Plugin {
  return {
    name: 'hub-lab-project-css',
    enforce: 'pre',
    transform(code, id) {
      if (!/[\\/]styles[\\/](web|dashboard)\.css/.test(id)) return null;
      return code.replaceAll('__WEB_SRC__', slashes(WEB_SRC)).replaceAll('__DASH_SRC__', slashes(DASH_SRC));
    },
  };
}

/**
 * Hub's proxy rewrites a query as it passes: Vite's `?import&raw` arrives as `?import=&raw=`, and Vite would then transform a README as code. Put back
 * the bare flags before Vite reads them.
 */
function bareQueryFlags(): Plugin {
  return {
    name: 'hub-lab-bare-query-flags',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (req.url?.includes('=')) req.url = req.url.replace(/([?&][\w-]+)=(?=&|$)/g, '$1');
        next();
      });
    },
  };
}

/**
 * Real project files import each other through `@/…`. Resolve that alias against the
 * project the importing file lives in, so `@web/components/ui/button` and
 * `@dash/components/ui/button` both keep working inside the lab.
 */
function projectAlias(): Plugin {
  const bases = [WEB_SRC, DASH_SRC].map((base) => ({ base, key: norm(base) }));
  return {
    name: 'goteav-project-alias',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      if (!source.startsWith('@/') || !importer) return null;
      const from = norm(importer);
      const hit = bases.find(({ key }) => from.startsWith(key));
      if (!hit) return null;
      return this.resolve(path.join(hit.base, source.slice(2)), importer, { ...options, skipSelf: true });
    },
  };
}

/**
 * Version folders live outside the Vite root, so `import.meta.glob` in the registry does not
 * notice new or deleted files. Watch them and rebuild the registry when the set changes.
 */
function watchVersions(): Plugin {
  const dirs = ['web', 'dashboard', 'hub'].map((d) => path.resolve(ROOT, d));
  const registry = path.resolve(ROOT, 'lab/src/core/registry.ts');
  return {
    name: 'goteav-watch-versions',
    configureServer(server) {
      server.watcher.add(dirs);
      // Only files the registry reads: page.tsx, README.md and screenshots — not review/ captures.
      const relevant = (file: string) => {
        const f = norm(file).replaceAll('\\', '/');
        if (f.includes('/review/')) return false;
        return /\/(page\.tsx|readme\.md)$/.test(f) || /\.(png|jpe?g|webp)$/.test(f);
      };
      const refresh = (file: string) => {
        if (!dirs.some((d) => norm(file).startsWith(norm(d))) || !relevant(file)) return;
        server.moduleGraph.getModulesByFile(registry)?.forEach((m) => server.moduleGraph.invalidateModule(m));
        server.ws.send({ type: 'full-reload' });
      };
      server.watcher.on('add', refresh);
      server.watcher.on('unlink', refresh);
    },
  };
}

export default defineConfig({
  root: path.resolve(ROOT, 'lab'),
  // One bundle folder per port: two labs sharing one overwrite each other's packages, and frames fail to load.
  cacheDir: path.join(ROOT, 'node_modules', `.vite-${PORT}`),
  // Hub serves the lab on its own origin at this path, so every address the lab writes carries it.
  base: '/lab/',
  // The gallery routes by hash and the frames are named files, so an unknown path is simply not found.
  appType: 'mpa',
  plugins: [bareQueryFlags(), projectCss(), projectAlias(), watchVersions(), react(), tailwindcss()],
  resolve: {
    alias: {
      '@lab': path.resolve(ROOT, 'shared'),
      '@web': WEB_SRC,
      '@dash': DASH_SRC,
    },
    // Real ui files resolve react from their own node_modules; force one copy.
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    // Every version up front. Found one at a time, a new package makes the server swap its bundle while a frame is loading, and that import fails.
    entries: ['*.html', '../web/*/*/page.tsx', '../dashboard/*/*/page.tsx', '../hub/*/*/page.tsx'],
  },
  server: {
    host: '127.0.0.1',
    port: PORT,
    strictPort: true,
    // Same origin through Hub's proxy, so no other site needs to read the lab.
    cors: false,
    fs: {
      allow: allowedRoots(),
      deny: ['.env', '.env.*', '*.{crt,pem,key,pfx}', '**/.git/**', '**/.panels/**'],
    },
  },
  preview: { host: '127.0.0.1', port: PORT, strictPort: true },
  build: {
    outDir: path.resolve(ROOT, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: path.resolve(ROOT, 'lab/index.html'),
        web: path.resolve(ROOT, 'lab/frame-web.html'),
        dashboard: path.resolve(ROOT, 'lab/frame-dashboard.html'),
        hub: path.resolve(ROOT, 'lab/frame-hub.html'),
      },
    },
  },
});
