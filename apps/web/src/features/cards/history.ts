/**
 * @file history.ts
 * @description What of an event's data a member may read in the sheet's History (review M1). An allowlist, because adapters and imports add
 * fields of their own: only a named field is shown, never an object or an id, and a member's id becomes their name.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Fields the event sentence or the sheet already says. */
const SAID_ELSEWHERE = new Set(['from', 'to', 'field', 'title', 'selfVerified', 'optionId']);

export interface EventFacts {
  /** "field: from → to". `label` is null for a status change, whose verb already names it. */
  change: { label: string | null; from: string | null; to: string | null } | null;
  rows: { key: string; label: string; value: string }[];
  /** An edit's fields, from `{ changes: [{ field, from?, to? }] }`. Absent when the event has none. */
  changes?: EventChange[] | undefined;
}

export interface EventChange {
  key: string;
  label: string;
  from: string | null;
  to: string | null;
  /** A long text (or one sent as a hash): only that it changed is said. */
  edited: boolean;
}

/** Texts too long for a line, and `body` arrives as a hash. */
const LONG_TEXT = new Set(['body', 'acceptance', 'prompt', 'comment', 'adrBody', 'notes', 'options']);

function changesOf(
  value: unknown,
  fieldNames: Readonly<Record<string, string>>,
  nameOf: NameOf,
): EventChange[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item: unknown) => {
    if (!item || typeof item !== 'object') return [];
    const { field, from, to } = item as { field?: unknown; from?: unknown; to?: unknown };
    const label = typeof field === 'string' ? fieldNames[field] : undefined;
    if (typeof field !== 'string' || !label) return [];
    if (LONG_TEXT.has(field)) return [{ key: field, label, from: null, to: null, edited: true }];
    const fromText = from === null || from === undefined ? null : printable(from, nameOf);
    const toText = to === null || to === undefined ? null : printable(to, nameOf);
    // A value that cannot be printed (an object, an unknown id) still says the field changed.
    const unreadable = (from != null && fromText === null) || (to != null && toText === null);
    return [{ key: field, label, from: fromText, to: toText, edited: unreadable }];
  });
}

type NameOf = (id: string) => string | undefined;

function printable(value: unknown, nameOf: NameOf): string | null {
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') {
    if (!value.trim()) return null;
    return UUID.test(value) ? (nameOf(value) ?? null) : value;
  }
  if (Array.isArray(value)) {
    const parts = value.map((item) => printable(item, nameOf)).filter((part) => part !== null);
    return parts.length === value.length && parts.length > 0 ? parts.join(' · ') : null;
  }
  return null;
}

export function eventFacts(
  data: Readonly<Record<string, unknown>>,
  fieldNames: Readonly<Record<string, string>>,
  nameOf: NameOf,
): EventFacts {
  const rows = Object.entries(data).flatMap(([key, value]) => {
    const label = fieldNames[key];
    if (!label || SAID_ELSEWHERE.has(key)) return [];
    const text = printable(value, nameOf);
    return text === null ? [] : [{ key, label, value: text }];
  });

  const field = data['field'];
  const label = typeof field === 'string' ? (fieldNames[field] ?? null) : null;
  const named = field === undefined || label !== null;
  const from = data['from'];
  const to = data['to'];
  // `null` is a real value here, "none". Anything else that cannot be printed hides the whole line.
  const fromText = from === null ? null : printable(from, nameOf);
  const toText = to === null ? null : printable(to, nameOf);
  const readable =
    named &&
    from !== undefined &&
    to !== undefined &&
    (from === null || fromText !== null) &&
    (to === null || toText !== null) &&
    (fromText !== null || toText !== null);

  const changes = changesOf(data['changes'], fieldNames, nameOf);
  return {
    change: readable ? { label, from: fromText, to: toText } : null,
    rows,
    ...(changes.length ? { changes } : {}),
  };
}
