/**
 * @file gallery.ts
 * @description The lab's gallery with no React: its state in the address, the frame of a version, what a pane shows, and how a device fits the stage
 * (docs/16 §6). Same rules as the gallery that came with the lab (`apps/lab/lab/src/shell`), with its hash route moved to Hub's query string.
 */
export const LAB_BASE = '/lab';

export type GalleryApp = 'web' | 'dashboard' | 'hub';
export type GalleryWidth = 390 | 768 | 1440 | 'fill';
export type GalleryLang = 'ar' | 'en';
export type GalleryTheme = 'light' | 'dark';

export const GALLERY_APPS: readonly GalleryApp[] = ['web', 'dashboard', 'hub'];
export const GALLERY_WIDTHS: readonly GalleryWidth[] = [390, 768, 1440, 'fill'];
export const TOKENS_PAGE = '_tokens';
export const TOKENS_VERSION = 'preview';
export const LIVE = 'live';
const BASELINE = 'v1-baseline';

/** Data scenarios a version may support, read by its own mocks (`apps/lab/lab/src/core/view.ts`). */
export const SCENARIOS = [
  'default',
  'empty',
  'loading',
  'frozen',
  'topup-pending',
  'topup-done',
  'topup-failed',
  'frontend',
] as const;

export interface GalleryState {
  app: GalleryApp | null;
  page: string | null;
  a: string | null;
  /** The other side of a compare. Null is one version. */
  b: string | null;
  width: GalleryWidth;
  lang: GalleryLang;
  theme: GalleryTheme;
  notes: boolean;
  scenario: string;
}

const isApp = (value: string | null): value is GalleryApp =>
  value !== null && (GALLERY_APPS as readonly string[]).includes(value);

const widthOf = (value: string | null): GalleryWidth => {
  if (value === 'fill') return 'fill';
  if (value === '390') return 390;
  if (value === '768') return 768;
  return 1440;
};

/** Language and theme start from Hub's own, so a version opens the way the page around it reads. */
export function readGallery(
  query: URLSearchParams,
  fallback: { lang: GalleryLang; theme: GalleryTheme },
): GalleryState {
  const app = query.get('app');
  const lang = query.get('lang');
  const theme = query.get('theme');
  return {
    app: isApp(app) ? app : null,
    page: query.get('page'),
    a: query.get('a'),
    b: query.get('b'),
    width: widthOf(query.get('w')),
    lang: lang === 'ar' || lang === 'en' ? lang : fallback.lang,
    theme: theme === 'light' || theme === 'dark' ? theme : fallback.theme,
    notes: query.get('notes') === '1',
    scenario: query.get('scenario') ?? 'default',
  };
}

/** The address of a state, as the query of the Redesign page. `null` removes a parameter. */
export function galleryQuery(state: GalleryState): Record<string, string | null> {
  return {
    view: 'gallery',
    app: state.app,
    page: state.page,
    a: state.a,
    b: state.b,
    w: String(state.width),
    lang: state.lang,
    theme: state.theme,
    notes: state.notes ? '1' : null,
    scenario: state.scenario === 'default' ? null : state.scenario,
  };
}

/** Where a version opens, from any page of Hub. */
export const versionQuery = (r: { app: string; page: string; version: string }) => ({
  view: 'gallery',
  app: r.app,
  page: r.page,
  a: r.version,
  b: null,
});

/** `#/<page>/<version>?lang=ar&theme=dark&scenario=empty`, which `apps/lab/lab/src/frame/mount.tsx` reads. */
export function frameHash(
  page: string,
  version: string,
  state: Pick<GalleryState, 'lang' | 'theme' | 'scenario'>,
) {
  const scenario = state.scenario !== 'default' ? `&scenario=${encodeURIComponent(state.scenario)}` : '';
  return `#/${encodeURIComponent(page)}/${encodeURIComponent(version)}?lang=${state.lang}&theme=${state.theme}${scenario}`;
}

/** Same origin: Hub's proxy serves the lab at `/lab`. Each app has its own frame, because the projects' stylesheets collide. */
export const frameSrc = (
  app: GalleryApp,
  page: string,
  version: string,
  state: Pick<GalleryState, 'lang' | 'theme' | 'scenario'>,
) => `${LAB_BASE}/frame-${app}.html${frameHash(page, version, state)}`;

export interface GalleryPage {
  liveUrl?: string | undefined;
  /** Null until a scan has said which versions have a `page.tsx`. */
  renderable: readonly string[] | null;
  versions: readonly string[];
}

export type PaneBody = 'frame' | 'live' | 'shots' | 'nothing';

/** What a pane shows: a version with a page in its frame, the running page, or the pictures of a baseline. */
export function paneBody(
  page: GalleryPage | undefined,
  pageSlug: string,
  version: string,
  shots: number,
): PaneBody {
  if (pageSlug === TOKENS_PAGE) return 'frame';
  if (version === LIVE) return page?.liveUrl ? 'live' : 'nothing';
  const renderable = page?.renderable;
  const hasPage = renderable ? renderable.includes(version) : version !== BASELINE;
  if (page?.versions.includes(version) && hasPage) return 'frame';
  return shots > 0 ? 'shots' : 'nothing';
}

/** What a compare can pick from: the running page first, when there is one. */
export const choicesOf = (page: GalleryPage | undefined): string[] =>
  page ? [...(page.liveUrl ? [LIVE] : []), ...page.versions] : [];

/** The second side when compare is switched on: the baseline, otherwise the first other choice. */
export function compareTarget(choices: readonly string[], a: string | null): string | null {
  if (a !== BASELINE && choices.includes(BASELINE)) return BASELINE;
  return choices.find((choice) => choice !== a) ?? null;
}

/** Renders at the device's real width, so breakpoints fire, and scales down to fit the stage. Never up. */
export function deviceBox(width: GalleryWidth, box: { w: number; h: number }, pad = 24) {
  if (width === 'fill') return { target: Math.max(box.w, 1), height: box.h, scale: 1 };
  const scale = Math.max(0.05, Math.min(1, (box.w - pad * 2) / width));
  return { target: width, height: Math.max(box.h - pad * 2, 1) / scale, scale };
}

/** A baseline's picture for the toolbar's mode: `<width>-<rtl|ltr>-<light|dark>`. Null is no such file, and the pane shows them all. */
export function shotName(state: Pick<GalleryState, 'width' | 'lang' | 'theme'>) {
  const dir = state.lang === 'ar' ? 'rtl' : 'ltr';
  return `${state.width === 'fill' ? 1440 : state.width}-${dir}-${state.theme}`;
}
