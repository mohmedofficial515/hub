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

  return { change: readable ? { label, from: fromText, to: toText } : null, rows };
}
