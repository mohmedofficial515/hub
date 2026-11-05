/**
 * @file keys.ts
 * @description Ported from F:/Goteav/redesign/hub/today/v5-peacock-app/kit/keys.ts. Contract: apps/web/README.md.
 */
type KeyEventLike = Pick<KeyboardEvent, 'key' | 'code' | 'shiftKey'>;

const SYMBOL_CODE: Record<string, string> = { '[': 'BracketLeft', ']': 'BracketRight' };

/**
 * The one place the app reads a key (review M16). Letters and symbols match the physical key through `e.code`, so a shortcut
 * still works on an Arabic layout, where `KeyJ` types «ت». `e.key` is the fallback when an event has no usable code.
 *
 * - `'j'` is the letter without Shift, `'E'` with Shift. `Ctrl+K` is `e.ctrlKey && matchKey(e, 'k')`.
 * - `'/'` also accepts the Slash key on any layout, and `'?'` accepts `؟` and Shift+Slash.
 * - Names (`'Enter'`, `'ArrowDown'`, `'Escape'`) are the same on every layout, so they compare by name.
 *
 * Known limit: on a Latin layout that moves letters (Dvorak, AZERTY) a shortcut follows the key's position, not its label.
 */
export function matchKey(e: KeyEventLike, key: string): boolean {
  if (key === '?') return e.key === '?' || e.key === '؟' || (e.code === 'Slash' && e.shiftKey);
  if (key === '/') return e.key === '/' || (e.code === 'Slash' && !e.shiftKey);
  if (key === ' ') return e.key === ' ' || e.code === 'Space';
  if (SYMBOL_CODE[key]) return e.code === SYMBOL_CODE[key] || e.key === key;
  if (key.length > 1) return e.key === key;
  const wantsShift = key !== key.toLowerCase();
  if (e.code?.startsWith('Key')) return e.code === `Key${key.toUpperCase()}` && e.shiftKey === wantsShift;
  return e.key.toLowerCase() === key.toLowerCase() && e.shiftKey === wantsShift;
}

/** The first of `keys` this event matches, for a handler with a table of keys. */
export const matchAny = <K extends string>(e: KeyEventLike, keys: readonly K[]): K | undefined =>
  keys.find((k) => matchKey(e, k));
