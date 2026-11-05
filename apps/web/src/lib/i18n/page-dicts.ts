/**
 * @file page-dicts.ts
 * @description Shapes of page catalogs the kit itself reads. Pages declare their own beside them.
 */
import type { PluralForms } from '@/lib/format';

import type authCatalog from '../../../messages/en/auth.json';
import type workspacesCatalog from '../../../messages/en/workspaces.json';

export interface RedesignMessages {
  title: string;
  metaOwner: PluralForms;
  metaOther: string;
  views: { label: string; review: string; gallery: string };
  gallery: {
    meta: string;
    toolbar: string;
    navLabel: string;
    tokens: string;
    live: string;
    pick: string;
    pickPrompt: string;
    noPages: string;
    pages: PluralForms;
    welcomeTitle: string;
    welcomeBody: string;
    compare: string;
    vs: string;
    scenario: string;
    widths: Record<'390' | '768' | '1440' | 'fill', string>;
    popout: string;
    openCard: string;
    brief: string;
    noNotes: string;
    nothing: string;
    noShotNamed: string;
    downTitle: string;
    downBody: string;
    downRetry: string;
  };
  filters: { app: string; status: string };
  apps: Record<'web' | 'dashboard' | 'hub', string>;
  brief: Record<'brief' | 'researching' | 'designing' | 'decided' | 'ported', string>;
  briefLabel: string;
  live: string;
  versions: PluralForms;
  hidden: PluralForms;
  showAllPages: string;
  onlyThisPage: string;
  railLabel: string;
  score: string;
  scoreOf: string;
  basedOn: string;
  noShot: string;
  enlarge: string;
  shotAlt: string;
  compareWithBase: string;
  addToCompare: string;
  removeFromCompare: string;
  ownerDecides: string;
  components: PluralForms;
  noComponents: string;
  bar: { pickOne: string; pickAnother: string; ready: string; open: string; clear: string; label: string };
  emptyTitle: string;
  emptyBody: string;
  emptyCmd: string;
  noMatchTitle: string;
  noMatchBody: string;
  clearFilters: string;
  errorThing: string;
  loading: string;
  compare: {
    title: string;
    description: string;
    versionA: string;
    versionB: string;
    swap: string;
    device: string;
    fill: string;
    lang: string;
    theme: string;
    light: string;
    dark: string;
    arabic: string;
    english: string;
    mode: string;
    split: string;
    curtain: string;
    showing: string;
    sync: string;
    notes: string;
    closest: string;
    noShot: string;
    noShotBody: string;
    openInLab: string;
    curtainLabel: string;
    close: string;
    a: string;
    b: string;
    noScore: string;
  };
  sheet: {
    enlarge: string;
    markPortedRef: string;
    markPortedHint: string;
    refRequired: string;
    savePorted: string;
    reviewTitle: string;
    copyCode: string;
    closeReview: string;
    noShots: string;
  };
}

export type AuthDict = typeof authCatalog;

export type WorkspacesDict = Omit<typeof workspacesCatalog, 'awaiting' | 'count'> & {
  awaiting: PluralForms;
  count: PluralForms;
};
