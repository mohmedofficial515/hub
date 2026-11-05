/**
 * @file kit-dict.ts
 * @description Shape of messages/{ar,en}/kit.json, the card vocabulary and the sheet. Ported from v5 kit/i18n.ts.
 */
import type { CardType, Role } from '@/features/cards/types';
import type { PluralForms } from '@/lib/format';

import type kitCatalog from '../../../messages/en/kit.json';

/**
 * Strings the kit itself needs (card vocabulary, states, the sheet). A page never repeats these: it reads
 * `kitMessages` with `useT` for a type or status label, and keeps its own copy in `pages/<view>/i18n.ts`.
 * `{x}` placeholders are split with `fill` so keys and commands render as LTR isolates.
 */
export type CardAction =
  | 'decide'
  | 'withdraw'
  | 'deliver'
  | 'start'
  | 'verify'
  | 'cancel'
  | 'acknowledge'
  | 'apply'
  | 'dismiss'
  | 'approve'
  | 'reject'
  | 'request_changes'
  | 'claim'
  | 'unclaim'
  | 'submit_review'
  | 'complete'
  | 'resume'
  | 'reject_delivery'
  | 'explore'
  | 'accept'
  | 'park'
  | 'to_plan'
  | 'to_tasks'
  | 'finish'
  | 'abandon'
  | 'send_to_review'
  | 'mark_ported'
  | 'release'
  | 'mark_ready'
  | 'mark_backlog'
  | 'reopen';

type LinkKindLabel = 'blocks' | 'blocked_by' | 'relates' | 'parent' | 'child' | 'duplicates';

export interface KitDict {
  languages: Record<'ar' | 'en', string>;
  sections: KitSections;
  types: Record<CardType, string>;
  roles: Record<Role, string>;
  routed: string;
  moreRoles: string;
  status: Record<string, string>;
  actions: Record<CardAction, string>;
  /** An action whose word depends on the card: Cancel on a need ends the request, and must not read like closing a form (review M5). */
  actionsByType: Partial<Record<CardType, Partial<Record<CardAction, string>>>>;
  done: Record<CardAction, string>;
  undo: string;
  actionFailed: string;
  dismiss: string;
  close: string;
  cancel: string;
  retry: string;
  all: string;
  filters: { mine: string; open: string; openCount: string; remove: string };
  mineMark: string;
  sourceStatus: Record<'ok' | 'lagging' | 'failing' | 'disabled', string>;
  search: string;
  copy: { copied: string; label: string; key: string; link: string };
  relative: { justNow: string };
  actor: { agentSuffix: string; system: string };
  online: string;
  lastSeen: string;
  error: { title: string; code: string; requestId: string; forbidden: string; forbiddenRole: string };
  empty: { comingNext: string };
  loading: { still: string };
  secret: { title: string; body: string };
  toast: { undoHint: string; blocked: string };
  confirm: { reason: string; reasonRequired: string };
  sheet: {
    notLoaded: string;
    deleted: string;
    label: string;
    actionsLabel: string;
    more: string;
    watch: string;
    unwatch: string;
    watching: string;
    copyKey: string;
    copyLink: string;
    archive: string;
    restore: string;
    archived: string;
    archiveTitle: string;
    archiveBody: string;
    notFound: string;
    notFoundBody: string;
    created: string;
    copyCode: string;
    tabs: { details: string; comments: string; history: string; links: string };
    noBody: string;
    comments: {
      empty: string;
      placeholder: string;
      label: string;
      send: string;
      hint: string;
      redacted: string;
      agent: string;
    };
    history: {
      empty: string;
      kinds: Record<string, string>;
      via: string;
      fields: string;
      selfVerified: string;
      viaNames: Record<string, string>;
      fieldNames: Record<string, string>;
      values: Record<string, string>;
    };
    links: {
      empty: string;
      kinds: Record<LinkKindLabel, string>;
      add: string;
      key: string;
      kind: string;
      invalid: string;
      self: string;
    };
    fields: {
      due: string;
      overdue: string;
      dueIn: string;
      responsible: string;
      requester: string;
      kind: string;
      severity: string;
      module: string;
      from: string;
      to: string;
      branch: string;
      reason: string;
      note: string;
      noteOptional: string;
    };
    task: {
      specialty: string;
      specialties: Record<string, string>;
      effort: string;
      acceptance: string;
      prompt: string;
      promptHint: string;
      claimer: string;
      unclaimed: string;
      origin: string;
      origins: Record<string, string>;
      pr: string;
      blockedBy: string;
    };
    decision: {
      question: string;
      options: string;
      pick: string;
      rationale: string;
      rationaleHint: string;
      recommended: string;
      chosen: string;
      pros: string;
      cons: string;
      cost: string;
      decider: string;
      decidedBy: string;
      reminders: string;
      noReminders: string;
      escalated: string;
      adr: string;
      adrNone: string;
      adrStatus: Record<string, string>;
      adrHint: string;
      save: string;
      needPick: string;
    };
    need: {
      steps: Record<'requested' | 'in_progress' | 'delivered' | 'verified', string>;
      kinds: Record<string, string>;
      location: string;
      locationHint: string;
      locationPending: string;
      deliveredBy: string;
      verifiedBy: string;
      verifyNote: string;
      saveDeliver: string;
      saveVerify: string;
    };
    change: {
      kinds: Record<string, string>;
      author: string;
      commits: string;
      files: string;
      added: string;
      removed: string;
      commitList: string;
      pr: string;
      prStates: Record<string, string>;
      session: string;
      changed: string;
      remaining: string;
      noSummary: string;
      noSummaryHint: string;
      duration: string;
      openPr: string;
    };
    handoff: {
      route: string;
      kinds: Record<string, string>;
      severities: Record<string, string>;
      pendingAge: string;
      summary: string;
      diff: string;
      breaking: string;
      nonBreaking: string;
      before: string;
      after: string;
      schemas: string;
      files: string;
      viewRaw: string;
      hideRaw: string;
      prompt: string;
      source: string;
      appliedTask: string;
      ackHint: string;
      saveAck: string;
      saveApply: string;
    };
    redesign: {
      lab: string;
      openLab: string;
      compare: string;
      base: string;
      score: string;
      review: string;
      openReview: string;
      touches: string;
      shots: string;
      noteRequired: string;
      noteOptional: string;
      saveApprove: string;
      saveReject: string;
      saveChanges: string;
      portTask: string;
      ported: string;
    };
    doc: {
      path: string;
      kinds: Record<string, string>;
      source: string;
      commit: string;
      words: string;
      outline: string;
      referencedBy: string;
      openGithub: string;
      indexed: string;
    };
    release: {
      version: string;
      repo: string;
      released: string;
      included: string;
      notes: string;
      noteTabs: { team: string; owner: string; accountant: string };
    };
  };
  blocksCount: PluralForms;
}

/** File-local strings of the kit's components, moved to the catalog: `useT(kitMessages).sections.<file>`. */
export type KitSections = (typeof kitCatalog)['sections'];
