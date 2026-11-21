---
version: v6-departure-board
title: Departure board (fix round)
status: review # draft | review | approved | rejected | ported
base: v3-departure-board
created: 2026-10-27
tokens: inherit # inherit | override (see tokens.css)
touches-components: [] # wallet-only parts; no shared component changes (see Porting)
ported:
---

# Departure board — fix round

## Idea
Same layout principle as v3: the page is organised around **what the balance can buy**. A navy status bar holds one
split-flap number (available), the hold and the points chip; below it an airport departures board built from the
customer's own flight searches checks each trip against the balance, and the **gate** (top-up) flips the board as an
amount is typed. v6 fixes the three blocking issues from v3's review, applies the owner's two decisions from review
round 1 (hidden = neutral state; covered trips open the real pre-filled flight search), and works through the review's
improvements.

## What changed from v3 (review finding → resolution)

### Blocking
| # | Finding | Resolution |
|---|---|---|
| B1 | Standby banner squeezed to a 62 px text column at 390 | Banner is `flex-col items-stretch` below `sm` with a full-width button, `sm:flex-row` above. Redesigned as a "Prices only — your balance is hidden" strip with an icon tile and a soft teal gradient (mirrors in RTL). |
| B2 | Focus lost to `<body>` after "Show balance & match trips" | The summary sentence now lives in the **same slot** as the standby strip (top of the board, not the footer). After reveal, focus moves to that `<p tabIndex=-1 aria-live>` (no scroll jump), the sentence is set immediately (no debounce) and is read out; the next Tab lands on the first row action. Verified en + ar. |
| B3 | Light-mode focus ring and selected state < 3:1 | `parts/rings.ts`: light surfaces use a full-opacity navy ring (`ring-primary`, offset 2) in light mode and teal in dark; the always-dark board / status bar keep teal (≥ 4.5:1 on navy). The amount field gets a real `focus-within` border + ring. Payment radios: selected = 2 px navy border (teal in dark) **plus a check badge**; focus = offset ring, so focus and selection never look alike. |

### Owner decisions (review round 1)
- **Hidden = neutral state.** While amounts are hidden the board shows prices only: the status column is removed (not
  masked), no COVERED / NEED / gap / Add buttons, and every row offers the same "Check price" action, so action
  weight cannot leak coverage either. Rows gain a trip line (round trip · 1 traveller · Economy) so the hidden board
  is still informative. Points show the count only (no ≈ $ value, including the redeem preview and the confirmation),
  the hold chip says "1 booking on hold" with no masked amount, and the goal card shows the trip price with no
  progress fill. Reveal is still one tap, in the board itself.
- **Covered trip → real search, same tab.** Every row links to `/{locale}/flights?…` built exactly like the real
  site's `historyHref(entry)` → `flightsHref(criteriaOfEntry(entry))` → nuqs `serializeFlightSearch`
  (`parts/search-href.ts`; defaults omitted like nuqs `clearOnDefault`), e.g.
  `/en/flights?trip=round&slices=CAI_IST_2026-11-14,IST_CAI_2026-11-21&cur=USD`. Format checked against the real
  nuqs serializer from `F:/Goteav/web/node_modules`. Covered rows show a **primary teal "Book with balance"** link;
  uncovered rows show "Add $X" + an icon "Check price" link; the goal card shows "Book with balance" once reached.
  Curated destinations (no searches) link to the blank search as "Search flights".

### Improvements
| # | Finding | Resolution |
|---|---|---|
| 1 | Gate ~1,120 px down at 390 | Below `xl` the order is board → gate → goal (goal moved after the gate). A floating **"Top up" pill** appears below `xl` whenever the gate is off screen (IntersectionObserver) and hides once any part of the gate is visible; it scrolls to the gate and focuses the amount field. Side-by-side gate now starts at `xl` (the board needs ~700 px). |
| 2 | Hidden default kills the board | Superseded by the owner's neutral-state decision (above). |
| 3 | "Short" status has no word | Status shows a small "NEED / ينقصك" label over the exact gap; SR text "Needs $56.50 more". |
| 4 | Board prices rounded up | Prices show cents everywhere (`$276.50`); the ceiling is used only for the Add amount. |
| 5 | Goal pin unlabelled | Visible "Goal / هدف" label (and "Your goal" when set) on mobile cards and from `md` in the table; accessible name "Goal: Dubai" contains the visible text. |
| 6 | Redeem failure unhandled | `try/catch/finally`: inline `role="alert"` error that takes focus, button becomes "Try again", nothing stuck on "Converting…". Lab scenario `?scenario=redeem-error` fails the first conversion. |
| 7 | Points value masked | Owner decision overrides: value hidden while amounts are hidden, shown otherwise. |
| 8 | Submit loses focus while redirecting | `aria-disabled` + guarded handler instead of `disabled`, and a `role="status"` "Taking you to the payment page…". |
| 9 | City announced in caps | `srText={r.city}`. |
| 10 | Story row's huge accessible name | `aria-labelledby` (title · state · amount) + `aria-describedby` (date · steps · ref · balance after); visual children `aria-hidden`. |
| 11 | Unlabelled second amount on mobile log | Prefixed "Bal." / "الرصيد". |
| 12 | Two controls named "Points" | Slider is "Points slider" / "شريط اختيار النقاط". |
| 13 | Muted-on-muted text 4.35–4.43:1 | `text-foreground/75` for "Balance after top-up", month in/out header and the Released chip. |
| 14 | 40–42 px targets | `min-w-11` on the icon "Check price" and redeem "All". |
| 15 | Amount field padding not clickable | Wrapper focuses the input (`cursor-text`). |
| 16 | Arabic copy | "رحلات المغادرة", "اكتمل". |
| 17 | Title wrong when most rows aren't covered | "What your balance can buy" / "ما يمكن لرصيدك شراؤه". |
| 18 | Redeem slider forced LTR | Kept deliberately: it is a numeric scale, paired with the LTR number field; documented. |
| 19 | "G a t e  c l o s e d" | New `words` mode on `Flap` (one tile per word); "GATE CLOSED", "PAY BY CARD", "WITH TOP-UP" use it. |
| 20 | Hidden balance as six tiles | One tile "$ •••••". |
| 21 | Story titles truncate at 768 | `line-clamp-2` below `lg`. |
| 22 | Inputs lack `name` | `amountUsd`, `method`, `points` (+ `autoComplete="off"`). |
| 23 | "0.00" placeholder reads as a value | "100…", lighter. |
| 24 | Filter not in URL | Deferred to the port (the real page uses nuqs; the lab hash is owned by the gallery). |
| 25 | `touch-action` | `touch-manipulation` on the page root. |

## Key decisions
- **Price + status share a table column** (status flips under the price) and the trip line wraps to two lines, so the
  table fits beside the gate at `xl` (710 px) and full width at `md`/`lg` with no horizontal scroll. Cards below `md`.
- **The summary strip replaces the standby strip** in the same place; it is the board's live region and the reveal
  focus target. Frozen shows "Wallet frozen: pay by card when you book." there.
- **No status column while hidden** rather than masked tiles: masking still reads as a broken display and as "there is
  a value here".
- Everything else (decimal-safe money via the real BigInt helpers, flight log stories, return-row states, frozen
  state, split-flap rules, reduced motion) is unchanged from v3.

## Verification
- Lab frame 390 / 768 / 1440 × ar / en × light / dark × hidden / shown: no horizontal overflow, no console errors;
  board table measured at 768 / 1024 / 1280 / 1440 with and without an amount and with a goal set: no table scroll.
- Scenarios default, empty, loading, frozen, topup-pending, topup-done, topup-failed, error, redeem-error at
  1440 en light, 390 ar dark and 768 ar light, hidden and shown: no overflow, no errors.
- Keyboard: reveal → focus on the summary (en/ar) → Tab to first row action; "Add $57" → focus on submit → Enter keeps
  focus on submit while redirecting; redeem failure → focus on the error → "Try again" succeeds; mobile "Top up" pill
  → focus in the amount field.
- Hidden board text contains no coverage words, gaps or Add amounts; points show the count only.
- Reduced motion: no tile transforms after an amount change.
- `pnpm typecheck` in `F:/Goteav/redesign`: passes (exit 0).
- Light-mode focus ring measured as `rgb(31, 50, 92)` (navy, about 12:1 on white) with a 2 px offset on presets, the log
  and the gate; the amount field shows a navy border plus a 3 px ring.
- Shots (amounts shown, tall viewport): `shots/1440-rtl-light.png`, `shots/1440-ltr-dark.png`,
  `shots/768-rtl-dark.png`, `shots/390-ltr-light.png`.

## Porting
Wallet-only parts replacing `balance-card`, `top-up-card` and `wallet-history` inside `wallet-settings.tsx`:
`status-bar`, `redeem-panel`, `departure-board`, `gate`, `trip-goal`, `flight-log`, `flap`, `log-model`, `rings`,
`mobile-top-up-bar`. `parts/search-href.ts` is replaced by the real `historyHref(entry)` rendered through `Link`
from `@/i18n/routing` (adds the locale). No change to shared components. Lab-only stand-ins: the derived return slice
for one-slice round trips in the shared mock (`LAB_RETURN_DAYS`), `REFUND_TO_PAYMENT`, booking labels, the
per-device goal (`wallet.v6.goal`), and the `error` / `redeem-error` scenarios. Backend asks from the owner's
decisions stay: booking id + short label on wallet transaction references, reliable refund → booking link.

## Open questions
- **Mobile length.** The gate is still ~1,140–1,220 px down at 390 (the board's four cards come first); the floating
  "Top up" pill covers the gap. Would you rather show three board rows on mobile with "Show all", or keep all rows?
- **"Book with balance" vs "Check price".** Both open the same pre-filled search; only the label and weight differ by
  coverage. Is "Book with balance" acceptable wording given the price may have changed since the search?
- **Curated fallback source** and **non-USD `lastSeenPrice`** (dropped today) are still open from v3.
- **Trip goal storage**: per-device for a pilot, or server-side?
