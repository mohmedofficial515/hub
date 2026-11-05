import type { ComponentType } from 'react';
import { field, parseFrontMatter, type FrontMatter } from './frontmatter';

export type App = 'web' | 'dashboard' | 'hub';
export type Status = 'draft' | 'review' | 'approved' | 'rejected' | 'ported' | 'reference';

export interface Version {
  app: App;
  page: string;
  id: string;
  title: string;
  status: Status;
  meta: FrontMatter;
  notes: string;
  load?: () => Promise<{ default: ComponentType }>;
  screenshots: { name: string; url: string }[];
}

export interface PageEntry {
  app: App;
  slug: string;
  meta: FrontMatter;
  brief: string;
  liveUrl: string;
  versions: Version[];
}

const pageModules = import.meta.glob<{ default: ComponentType }>('../../../{web,dashboard,hub}/*/*/page.tsx');
const versionReadmes = import.meta.glob<string>('../../../{web,dashboard,hub}/*/*/README.md', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const pageReadmes = import.meta.glob<string>('../../../{web,dashboard,hub}/*/README.md', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const images = import.meta.glob<string>('../../../{web,dashboard,hub}/*/*/{*,shots/*}.{png,jpg,jpeg,webp}', {
  query: '?url',
  import: 'default',
  eager: true,
});

/** `../../../web/flights/v2-split/page.tsx` → ['web', 'flights', 'v2-split', 'page.tsx'] */
const parts = (key: string) => key.replace(/^(\.\.\/)+/, '').split('/');

const STATUSES: Status[] = ['draft', 'review', 'approved', 'rejected', 'ported'];

function versionNumber(id: string) {
  return Number(/^v(\d+)/.exec(id)?.[1] ?? 0);
}

function build(): PageEntry[] {
  const pages = new Map<string, PageEntry>();
  const versions = new Map<string, Version>();

  const pageFor = (app: App, slug: string) => {
    const key = `${app}/${slug}`;
    let entry = pages.get(key);
    if (!entry) {
      entry = { app, slug, meta: {}, brief: '', liveUrl: '', versions: [] };
      pages.set(key, entry);
    }
    return entry;
  };

  const versionFor = (app: App, slug: string, id: string) => {
    const key = `${app}/${slug}/${id}`;
    let entry = versions.get(key);
    if (!entry) {
      entry = {
        app,
        page: slug,
        id,
        title: id,
        status: id === 'v1-baseline' ? 'reference' : 'draft',
        meta: {},
        notes: '',
        screenshots: [],
      };
      versions.set(key, entry);
      pageFor(app, slug).versions.push(entry);
    }
    return entry;
  };

  for (const [key, raw] of Object.entries(pageReadmes)) {
    const [app, slug] = parts(key) as [App, string];
    const { data, body } = parseFrontMatter(raw);
    const entry = pageFor(app, slug);
    entry.meta = data;
    entry.brief = body;
    entry.liveUrl = field(data, 'live-url');
  }

  for (const [key, raw] of Object.entries(versionReadmes)) {
    const [app, slug, id] = parts(key) as [App, string, string];
    if (id === 'research') continue;
    const { data, body } = parseFrontMatter(raw);
    const v = versionFor(app, slug, id);
    v.meta = data;
    v.notes = body;
    v.title = field(data, 'title') || id;
    const status = field(data, 'status') as Status;
    if (STATUSES.includes(status)) v.status = status;
  }

  for (const [key, load] of Object.entries(pageModules)) {
    const [app, slug, id] = parts(key) as [App, string, string];
    versionFor(app, slug, id).load = load;
  }

  for (const [key, url] of Object.entries(images)) {
    const [app, slug, id, ...rest] = parts(key) as [App, string, string, ...string[]];
    const name = rest[rest.length - 1];
    if (id === 'research') continue;
    versionFor(app, slug, id).screenshots.push({ name, url });
  }

  const list = [...pages.values()];
  for (const p of list) p.versions.sort((a, b) => versionNumber(a.id) - versionNumber(b.id));
  return list.sort((a, b) => a.app.localeCompare(b.app) || a.slug.localeCompare(b.slug));
}

export const registry: PageEntry[] = build();

export function findVersion(app: string, page: string, id: string): Version | undefined {
  return registry.find((p) => p.app === app && p.slug === page)?.versions.find((v) => v.id === id);
}
