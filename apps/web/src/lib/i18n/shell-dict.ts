/**
 * @file shell-dict.ts
 * @description Shape of messages/{ar,en}/shell.json. Ported from v5 i18n.ts.
 */
import type { ViewId } from '@/components/shell/router';
import type { PluralForms } from '@/lib/format';

/** Shell strings only. Pages keep their own in `pages/<view>/i18n.ts`, the card vocabulary is in `kit/i18n.ts`. */
export type NavGroup = 'work' | 'knowledge' | 'workspace';

export interface ShellDict {
  gate: { session: string; notMember: string; notMemberBody: string; toProjects: string };
  placeholder: { title: string; body: string };
  nav: Record<ViewId, string>;
  groups: Record<NavGroup, string>;
  /** Counter badges in words (08 §6: `aria-label="3 unread"`), `#` is the number. */
  counts: Record<
    | 'inbox'
    | 'timeline'
    | 'planning'
    | 'tasks'
    | 'decisions'
    | 'decisionsOverdue'
    | 'needs'
    | 'handoffs'
    | 'redesign'
    | 'onboarding'
    | 'members'
    | 'settings',
    PluralForms
  >;
  sidebar: {
    newProject: string;
    label: string;
    collapse: string;
    expand: string;
    workspace: string;
    switchTo: string;
    allWorkspaces: string;
    language: string;
    toEnglish: string;
    toArabic: string;
    themeToDark: string;
    themeToLight: string;
    me: string;
    profile: string;
    tokens: string;
    shortcuts: string;
    signOut: string;
    shortcutsOn: string;
    openMenu: string;
    closeMenu: string;
  };
  header: {
    connecting: string;
    notLive: string;
    breadcrumb: string;
    search: string;
    newCard: string;
    live: string;
    reconnecting: string;
    me: string;
  };
  skip: string;
  palette: {
    label: string;
    placeholder: string;
    empty: string;
    recent: string;
    pages: string;
    cards: string;
    actions: string;
    jump: string;
    hint: string;
    act: {
      newTask: string;
      newDecision: string;
      newNeed: string;
      newHandoff: string;
      toggleTheme: string;
      toggleLanguage: string;
      switchWorkspace: string;
      copyMcp: string;
      showShortcuts: string;
    };
    mcpCopied: string;
  };
  shortcuts: {
    title: string;
    disable: string;
    disableHint: string;
    groups: { nav: string; go: string; lists: string; cards: string };
    items: Record<string, string>;
  };
  newCard: {
    failed: string;
    title: string;
    types: string;
    titleLabel: string;
    titleHint: string;
    role: string;
    priority: string;
    body: string;
    create: string;
    createOpen: string;
    created: string;
    required: string;
  };
  notFound: { title: string; body: string };
  viewError: string;
}
