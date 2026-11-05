/**
 * @file audit-label.ts
 * @description Audit rows in words (review m6). The machine code stays in the expanded row. An action nobody named falls back to its group, never to the code.
 */
export interface AuditWords {
  /** Whole codes that are not card actions, written `identity:sign_in`, because a catalog key cannot hold a dot. */
  codes: Readonly<Record<string, string>>;
  /** Card verbs the kit's action names do not cover: `create`, `sync`. */
  verbs: Readonly<Record<string, string>>;
  groups: Readonly<Record<string, string>>;
  actions: Readonly<Record<string, string | undefined>>;
  actionsByType: Readonly<Record<string, Readonly<Record<string, string | undefined>> | undefined>>;
  types: Readonly<Record<string, string | undefined>>;
}

/** `cards.redesign.create` and `task.create` are both type and verb. `card.link` has no type word. */
export function auditActionLabel(code: string, words: AuditWords): string {
  const whole = words.codes[code.replace(/\./g, ':')];
  if (whole) return whole;
  const parts = code.split('.');
  const [type, verb] = parts[0] === 'cards' ? [parts[1], parts[2]] : [parts[0], parts[1]];
  if (type && verb) {
    const name =
      words.actionsByType[type]?.[verb] ??
      words.actions[verb] ??
      words.verbs[verb] ??
      (parts[0] === 'cards' ? words.verbs['change'] : undefined);
    const typeWord = words.types[type];
    if (name && typeWord) return `${name} · ${typeWord}`;
    if (name && type === 'card') return name;
  }
  return words.groups[parts[0] ?? ''] ?? words.groups['system'] ?? '';
}

/** `redesign.create GTV-309` is the code again, and the row's target already names the card. A sentence stays. */
export const isMachineSummary = (summary: string) => /^[a-z_]+(\.[a-z_]+)+( [A-Z0-9]+-\d+)?$/.test(summary);

export const isOpaqueId = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
