import { useSyncExternalStore } from 'react';
import { NOW, type HubScenario } from '@lab/mocks/hub-app';
import { directoryFor, invitesFor, type DirectoryRow, type InviteRow } from '@lab/mocks/hub-app/members';
import {
  auditFor,
  generalSeed,
  notificationsFor,
  sourcesFor,
  specialtyMapSeed,
  tokensFor,
  type AuditRow,
  type GeneralSettings,
  type NotificationPrefs,
  type SourceRow,
  type TokenRow,
} from '@lab/mocks/hub-app/settings';

/**
 * The lab's stand-in for the workspace admin API: members, invites, sources, tokens, settings and the audit log.
 * Members and Settings share it, and `useMyCounts` reads it, so revoking an invite or fixing a source moves the
 * sidebar's badge. A new scenario starts from fresh state, as `card-store` does.
 */
export interface AdminState {
  directory: DirectoryRow[];
  invites: InviteRow[];
  sources: SourceRow[];
  tokens: TokenRow[];
  /** Newest first. Append-only: there is no write here other than `writeAudit`. */
  audit: AuditRow[];
  general: GeneralSettings;
  specialtyMap: typeof specialtyMapSeed;
  notifications: NotificationPrefs;
}

type ScenarioKey = HubScenario | 'error';

const seed = (scenario: ScenarioKey): AdminState => ({
  directory: directoryFor(scenario),
  invites: invitesFor(scenario),
  sources: sourcesFor(scenario),
  tokens: tokensFor(scenario),
  audit: auditFor(scenario),
  general: generalSeed,
  specialtyMap: specialtyMapSeed,
  notifications: notificationsFor(scenario),
});

let scenarioKey: ScenarioKey | null = null;
let state: AdminState | null = null;
let auditSeq = 1;
const listeners = new Set<() => void>();

function stateFor(scenario: ScenarioKey): AdminState {
  if (scenario !== scenarioKey || !state) {
    scenarioKey = scenario;
    state = seed(scenario);
  }
  return state;
}

function subscribe(notify: () => void) {
  listeners.add(notify);
  return () => listeners.delete(notify);
}

/** Read the store. Pass `useSession().scenario`. */
export function useAdmin(scenario: ScenarioKey): AdminState {
  return useSyncExternalStore(subscribe, () => stateFor(scenario));
}

/** Replace part of the store. Keep the previous value in a closure if the toast offers Undo. */
export function updateAdmin(update: (s: AdminState) => AdminState) {
  if (!state) return;
  state = update(state);
  listeners.forEach((l) => l());
}

/** Every admin write leaves a row, as the API does (`effects: audit`). There is no edit or delete on purpose. */
export function writeAudit(row: Pick<AuditRow, 'action' | 'targetType' | 'targetId' | 'summary' | 'actorId'>) {
  const entry: AuditRow = {
    ...row,
    id: `local-${auditSeq++}`,
    actorKind: 'user',
    via: 'web',
    ip: '10.20.0.14',
    userAgent: 'Chrome 141 on Windows',
    createdAt: NOW,
  };
  updateAdmin((s) => ({ ...s, audit: [entry, ...s.audit] }));
}

/** What the sidebar's red Settings count counts: a source that is on, and not healthy. */
export const isSourceProblem = (s: SourceRow) => s.enabled && s.status !== 'ok';
