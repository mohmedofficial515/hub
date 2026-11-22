# Review — web/home/v2-departure-line   (2026-11-21)

Reviewer: ux-critic (independent). Lab frame `http://127.0.0.1:7320/lab/frame-web.html#/home/v2-departure-line`,
own browser context, 390 / 768 / 1440 x ar (rtl) / en (ltr) x light / dark, plus scenarios empty / loading / error / long at 390.

| Pillar | Score /10 | One-line verdict |
|---|---|---|
| Hierarchy & focus | 8 | Search card is clearly the one job; arc is quiet; hero no longer over-promises. |
| Task flow & speed | 8 | Focus advances after each pick, recent searches one click away; maintenance state leaks a dead action. |
| Layout & responsiveness | 7 | No overflow anywhere; at 390 the Search button sits 46 px under the fold; dead space in the flights tile at 1440. |
| RTL / bilingual | 8 | Mirroring correct (From on the start side, steps right-to-left, swap button placed by logical props); LTR arrows in RTL rows. |
| Accessibility | 8 | Solid 2 px navy focus ring on every stop, logical tab order, labelled controls, CLS 0.013, no console errors. |
| Visual craft & originality | 7 | Flat, calm, on-brand; the departure arc is a real idea. One shadow breaks the "lines not shadows" rule. |
| Motion & feedback | 8 | One entrance and the arc draw, reduced-motion respected, busy state on Search. |

Overall: **7.7 / 10**

## Blocking issues (must fix before approval)

1. **Shadow on the search card and popovers break the owner rule "thin lines, not shadows".**
   `parts/search-card.tsx:136`, `:275` (`shadow-(--elev-float)`), `parts/field.tsx:91` (popover), token
   `tokens.css:157` / `:209` (`0 12px 32px`). Visible at every width, strongest in light mode around the card at 1440.
   The README calls it "the one shadow", but the rule has no such exception. Fix: drop the shadow and keep the 1 px
   `--line` border (the card already has one); if the overlap over the navy edge needs separation, ask the owner
   for an explicit exception instead of shipping it silently.
2. **Maintenance scenario keeps live "search again" rows that target a form that is not there.**
   `?scenario=error`, 390 and 1440: recent searches stay under the maintenance notice (`page.tsx` renders
   `RecentSearches` unconditionally; `fromHistory` scrolls to `#flight-search`, which does not exist in that state).
   A click does nothing visible: a dead primary-looking action while search is paused. Fix: hide recent searches
   in maintenance, or show them read-only with no action.

## Improvements

- **Major — Search button below the fold at 390.** 390x844 ar: button top 838 px, bottom 890 px (en: 827/879).
  The brief goal says flight search is visible without a tap at 390; fields are, the action is not. The arc
  (`page.tsx`, compact `RouteArc`) costs ~150 px. Suggest: on `<sm` hide the arc until a route is chosen, or show
  only the two codes in one line. (README open question; my recommendation is to hide it on phones.)
- **Minor — Trip-type segments 40 px tall** (`search-card.tsx` label `min-h-10`). Above AA 24 px but under the
  44 px touch target used everywhere else on the card. Use `min-h-11` on phones.
- **Minor — Step 3 uses a ticket icon where steps 1 and 2 use numbers** (`parts/sections.tsx`, Steps; 1440 and 390).
  Breaks the sequence the line implies. Use "3" (icon inside the step body if wanted).
- **Minor — Empty area in the flights tile at 1440** (`parts/sections.tsx` Services): the tile stretches to the
  4-row list and leaves ~180 px of blank space above its button. Align the button under the text, or let the
  tile size to content (`items-start`).
- **Minor — Direction arrows in RTL rows.** Recent searches `IST → AMM` / `JED → LON` (recent-searches.tsx) point
  against Arabic reading order beside "إسطنبول إلى عمّان". Either mirror the arrow in rtl or drop it and keep
  the Arabic "إلى" line as the reading cue.
- **Minor — Hero headline in maintenance** still says "احجز رحلة طيرانك" while search is paused. Acceptable, but a
  softer lead (or none) reads more honestly in that state.
- **Note (owner-accepted, not a finding)** — white on teal Search button measures 2.57:1; it is the only text under
  4.5:1 found on the page in light ar at 1440.

## What is better than baseline

- 390: baseline shows a stock photo, italic gradient headline promising private jets, and two pills — no field
  above the fold. v2 shows trip type, From, To, both dates and travellers on the first screen; the task starts
  with zero taps.
- Keyboard: picking From moves focus to To (verified: "CAI" + Enter lands on إلى), fixing audit L-55.
- Trip type is a real radio group with visible selected state (L-53); all steppers and buttons are named.
- Services: seven "soon" items as a flat ruled list with icon + word badges, no shimmer, blur or dimming (L-58);
  only flights is actionable, with an outline button, so the page keeps one primary button.
- Manage booking now has a home-page entry (support block) — absent in baseline.
- No hot-linked imagery, no gradients, Cairo, weights at most 700, smallest text 12 px (text-xs), no coloured
  card stripes, gold only on the arc.

## Measurements

- Horizontal overflow: none at any of the 12 combinations or 4 scenarios (scrollWidth = clientWidth).
- Console errors: none. CLS after load (1440 ar light): 0.013.
- Tab order (1440 ar): skip link, logo, الطيران, إدارة الحجز, المساعدة, English, theme, تسجيل الدخول, trip type,
  From, To, Departure, Return, Travellers, Search, recent rows (search again / remove) x3, "ابحث عن رحلة" in
  services. Focus ring 2 px solid #1f325c, offset 2.
- Interactive elements under 44 px: skip link (only when focused) and the logo link (24 px tall) — both pass AA.

## Screenshots

In this folder: `{390,768,1440}-{rtl,ltr}-{light,dark}.png` (full page), `focus-from-1440-rtl-light.png`,
`focus-trip-1440-rtl-light.png`, `from-picker-1440-rtl-light.png`, `scenario-{empty,loading,error,long}-390-rtl-light.png`.
Baseline compared: `../../v1-baseline/390-rtl-light.png`, `../../v1-baseline/1440-rtl-light.png`.

## Fixes after review (2026-11-21)

v2 is in `review` and stays frozen, so every fix is in **`../../v3-departure-line/`** (`base: v2-departure-line`,
`status: review`). Details and measurements in `v3-departure-line/README.md`.

| Finding | Fix (v3) | Verified |
|---|---|---|
| Blocker 1, shadows | `--elev-float` deleted; no `shadow-*` on the card, maintenance notice or popovers; popovers bordered with `--border-strong` | 0 elements with a box-shadow in all 12 modes |
| Blocker 2, maintenance | Recent searches not rendered; hero h1/lead and the flights tile say search is paused | `scenario=error` 390 + 1440: no recent section, no form, h1 "البحث عن الرحلات يعود قريبًا" |
| Major, Search under the fold at 390 | Phones show a one-line route (`RouteLine`: codes + hairline + plane), tighter hero | Search bottom 816 px (ar) / 805 px (en) on 390x844 |
| Trip type 40 px | `min-h-11` | 44 px at all widths |
| Arrows in RTL rows | Codes isolated with `<bdi>`, joiner `←` in ar, `→` in en | 1440 ar capture |
| Step 3 icon | Number 3 | 1440 / 390 captures |
| Flights tile space at 1440 | Grid `items-start`, button follows the text | 1440 capture |
| Hero in maintenance | New title and lead | as blocker 2 |

Commands: Playwright `v3-departure-line/review/verify-matrix.js` and `verify-scenarios.js` (12 modes + 4 scenarios,
no overflow, no console errors); `npx tsc --noEmit -p tsconfig.json` and `pnpm typecheck` in `apps/lab`: exit 0.
