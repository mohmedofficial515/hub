/**
 * @file card-link.ts
 * @description Where an old-style card address leads. The API writes `/{locale}/{ws}/cards/{key}` into an ADR when a
 * decision is decided (apps/api decisions/application/decision-actions.ts, `hubUrl`), and docs/09 §14 names the same
 * deep link. The sheet is `?card=` over a page, so this address opens it over Today, and the sheet moves a plan or an
 * idea to its own page once it loads.
 */

/** A card key as a link may carry it: a prefix of two to six letters or digits, then a number. */
const CARD_KEY_RE = /^[A-Za-z][A-Za-z0-9]{1,5}-\d+$/;

/** The address that shows the card, or null when `key` is not a card key. */
export function cardLinkTarget(locale: string, ws: string, key: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(key);
  } catch {
    return null;
  }
  if (!CARD_KEY_RE.test(decoded)) return null;
  return `/${locale}/${ws}/today?card=${encodeURIComponent(decoded.toUpperCase())}`;
}
