/**
 * @file lab-words.ts
 * @description The words of the lab's own frame. The owner asked for the lab's interface as it always was (2026-11-06): dark, left to right and in English
 * in every locale of Hub, because it is a workbench around a page whose language is chosen in its toolbar. So they are not in `messages/`. What opens over
 * the frame, such as a card's sheet, keeps Hub's language.
 */
import type { GalleryApp, GalleryWidth } from './gallery';

export const LAB_WORDS = {
  title: 'Redesign Lab',
  toolbar: 'Lab controls',
  navLabel: 'Lab pages and versions',
  backToHub: 'Back to Hub',
  tokens: 'Tokens',
  live: 'live',
  pick: 'Page and version',
  pickPrompt: 'Select a page',
  noPages: 'No pages yet',
  apps: { web: 'Website', dashboard: 'Dashboard', hub: 'Hub' } satisfies Record<GalleryApp, string>,
  compare: 'Side-by-side',
  versionA: 'First version',
  versionB: 'Second version',
  vs: 'vs',
  scenario: 'Data scenario',
  device: 'Device size',
  language: 'Language',
  theme: 'Theme',
  notes: 'Status & notes',
  popout: 'Open frame in new tab',
  openCard: (key: string) => `Open ${key}: status, review, comments and verdict`,
  approve: 'Approve',
  requestChanges: 'Request changes',
  brief: 'Page brief',
  noNotes: 'This version has no notes.',
  nothing: (version: string) => `Nothing to render yet for ${version}.`,
  noShotNamed: (name: string) => `No screenshot named ${name}.png, showing all.`,
  downTitle: 'The lab is not running',
  downBody: 'Pictures and the review still work. This command starts the lab with Hub:',
  downRetry: 'Check again',
  welcome: (pages: number, versions: number) =>
    `${pages} ${pages === 1 ? 'page' : 'pages'} · ${versions} ${versions === 1 ? 'version' : 'versions'}. Pick a page or the token preview from the sidebar.`,
} as const;

export const LAB_WIDTHS: readonly { value: GalleryWidth; label: string }[] = [
  { value: 390, label: 'Mobile' },
  { value: 768, label: 'Tablet' },
  { value: 1440, label: 'Desktop' },
  { value: 'fill', label: 'Fill' },
];

export const LAB_LANGS = [
  { value: 'ar', label: 'AR · RTL' },
  { value: 'en', label: 'EN · LTR' },
] as const;
