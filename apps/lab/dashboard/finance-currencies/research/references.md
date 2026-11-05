# References — Finance / Currencies & FX rates (Goteav dashboard)

Research date: 2026-10-28. Screenshots in this folder: `ref-<product>-<view>.png` (d = 1440, m = 390).
Honesty note: Stripe/Revolut Business/Mercury/Airwallex dashboards are behind login, so I did NOT see their
admin UIs. For those I only cite public pages and mark anything else "unverified (from general knowledge)".

## Job to be done
A finance operator scans 10 currencies, trusts each rate (raw vs effective, margin, source, freshness), spots
what changed or is stale, and safely acts on one currency (pin a manual rate, toggle visibility, set
chargeable vs display-only) without losing context of the rest.

## Reference table
| # | Product / URL | Pattern | Why it works | Fit for Goteav |
|---|---|---|---|---|
| 1 | TradingView major pairs — https://www.tradingview.com/markets/currencies/rates-major/ (`ref-tradingview-forex-d/m.png`) | One row per pair: round flag glyph, small grey pill with ticker (EURUSD), full name in caps next to it, then right-aligned numeric columns; change % and abs change coloured green/red with sign; tab strip "Overview / Performance / Technicals" switches column sets instead of widening the table. Category chips (Major, Minor, Exotic, Americas...) above. | Identity (glyph + code pill + name) in one left cell; numbers right-aligned in tabular style; column *sets* per tab keeps density without horizontal scroll. | High. Copy the identity cell and column-set tabs ("Rates / Pricing / Status"). Skip Buy/Sell rating. |
| 2 | TradingView Arabic (RTL) — https://ar.tradingview.com/markets/currencies/rates-major/ (`ref-tradingview-ar-d.png`) | Whole table mirrors: identity column on the right, number columns flow leftward, header chips and tabs mirror. Numbers stay Latin digits and LTR; sign is placed AFTER the number ("0.00051+", "0.12%-"). | Arabic-first proof that tables mirror cleanly with LTR numerals. The trailing sign is a visible RTL bug-ish choice: reads awkwardly. | High as RTL evidence. Keep numerals LTR but wrap each in `dir="ltr"` + `unicode-bidi: isolate`, sign leading ("+0.12%"). |
| 3 | Wise currency converter — https://wise.com/gb/currency-converter/ and /usd-to-eur-rate (`ref-wise-rates-d.png`, `ref-wise-browse-d.png`) | Currency selector = round flag + bold 3-letter code + chevron; label "Mid-market exchange rate" with a (?) tooltip above the single rate line "$1 USD = 0.8987 EUR". Separate "Browse all currencies" and "Get rate alerts" in a sub-nav. | Names the rate type explicitly and explains it on demand — this is exactly the raw-vs-effective distinction. Rate expressed as "1 X = n Y" is the most legible form. | High. Label raw vs effective rate with a tooltip definition; show "1 USD = n" phrasing in detail panel. Marketing hero scale is NOT for a dashboard. |
| 4 | Xe — https://www.xe.com/currencytables/ (`ref-xe-currencytables-d.png`) | Base currency + date selector (flag + "USD - US Dollar") that regenerates a whole table; page also offers an Arabic site switch banner. | Base and as-of date are first-class controls, so a rate is never ambiguous. | Medium. Show "Base USD - as of 14:05" in the table header; date picker only in history view. |
| 5 | Stripe docs: supported currencies — https://docs.stripe.com/currencies (`ref-stripe-currencies-d.png`) | Concept model separates presentment vs settlement currency; per-currency rules (zero-decimal, special cases, min/max charge amounts) documented as attributes. Right-rail "On this page" index. | Confirms the domain model: "chargeable vs display-only" is a first-class attribute, and per-currency rules (decimals, min/max) belong with the currency. Dashboard UI itself: unverified. | High for modelling: show decimals, min/max charge in the detail panel. |
| 6 | Shopify Markets currency formatting — https://help.shopify.com/en/manual/international/pricing/currency-formatting (`ref-shopify-markets-d.png`) | Per-market currency settings: rounding, rate adjustment (margin) and format preview. Admin UI itself unverified (login-gated; doc page only seen). | Live "how will the price look" preview next to the margin/rounding inputs. | High: margin input in the side panel with instant preview of 100 USD -> n. |
| 7 | Mantine DataTable — https://icflorescu.github.io/mantine-datatable/ (`ref-mantine-datatable-d.png`) | Sticky header, selection checkboxes, right-click row context menu (Edit / Delete), expandable row, column visibility toggle (sparkle icon at header end), pagination footer "1 - 20 / 500". | Row actions via context menu and per-row icon buttons; column-visibility control; expandable row for secondary detail. | Medium-high: column toggle + row context menu; no pagination needed for 10 rows. |
| 8 | Ant Design Table — https://ant.design/components/table (`ref-antd-table-d.png`) | Fixed columns (left/right sticky), filter/sort in header, expandable rows, `direction="rtl"` support documented in the library. RTL support claim is from library docs, not independently tested. | Mature sticky-column + RTL-aware table behaviours as a spec baseline. | Medium: use as checklist for sticky identity column + sticky actions column. |
| 9 | Linear (method/principles) — https://linear.app/method (`ref-linear-method-d.png`) | Dense list rows, keyboard-first, side panel for detail, status as small coloured glyph rather than text chip. Only the marketing page was captured; list UI itself is from general knowledge (unverified here). | Quiet rows, one accent, hover reveals actions, `J/K` navigation. | High for feel: hover-revealed quick actions, peek panel on row focus. |
| 10 | Revolut / Mercury / Airwallex dashboards | Login-gated; Revolut converter page captured (`ref-revolut-rates-d.png`) but not the business app. Airwallex /fx URL returned 404 (`ref-airwallex-fx-d.png` is a not-found page, ignore). | — | Unverified; not used for claims. |

UI-UX-Pro-Max output: design system suggestion "Minimalism & Swiss" with IBM Plex Sans (financial/trustworthy),
avoid "unclear fees". UX domain: tables must not overflow on mobile (horizontal scroll wrapper or card layout);
bulk actions via checkbox column + action bar. Chart domain: line chart needs >= 4 points, never rely on hue
alone, provide a visible data-table fallback and a concise trend summary (applies to sparklines).

## Recurring patterns (ranked by evidence)
1. **Identity cell = glyph + code pill + names** (TradingView, Wise, Xe): round mark at left, bold 3-letter code,
   secondary name in the user's language; other two languages on hover or in the panel.
2. **Numbers right-aligned, tabular figures, sign+colour on change** (TradingView EN and AR).
3. **Column sets via tabs/segmented control instead of horizontal scroll** (TradingView Overview/Performance).
4. **Name the rate type and define it on demand** (Wise "Mid-market exchange rate (?)"; Stripe presentment vs settlement).
5. **Detail through side panel / expandable row, list stays visible** (Mantine DataTable expandable rows; Linear style peek).
6. **Whole-table mirroring in RTL with LTR numerals** (TradingView AR) — with the sign-position caveat.
7. Base + as-of timestamp always visible (Xe base/date).
8. Row actions: hover icons + context menu, bulk via checkbox bar (Mantine, UI-UX-Pro-Max).

## Multi-field cell organisation (recommendation)
- Cell A (identity, sticky start): `[mark] USD  US Dollar` line 1 bold code, line 2 muted localized name; Arabic
  UI shows Arabic name, tooltip shows EN/TR names and 3-language abbreviations.
- Cell B (rate): effective rate large, raw rate small muted below ("raw 1.0000"), margin as a tiny chip when non-zero.
- Cell C (change): chip "+0.12%" + 7-point sparkline (>= 4 points, non-colour cue: arrow glyph).
- Cell D (status): one pill stack max two items: stale (amber clock), pinned (pin icon), display-only (outline).
- Cell E (actions, sticky end): visibility switch + kebab; other actions revealed on hover/focus.

## Bold ideas worth testing
1. **Effective-vs-raw "spread bar"**: under each rate draw a tiny horizontal bar showing raw point and effective
   point on a shared scale; margin becomes visible without a column. Fits Goteav because margin/pinned overrides
   are the finance team's main worry; a pinned rate shows a pin on the bar where the market has drifted away.
2. **Freshness as a ring around the mark**: the SVG currency mark gets a thin ring that fills/decays with
   age of last update and turns amber when stale, replacing a separate "stale" badge and saving a column.
3. **"What would customers see" preview in the side panel**: a mini price card (100 USD -> n in this currency, with
   rounding/format) in the locale-appropriate direction, plus a chargeable/display-only toggle that visibly greys the
   "Pay" button in the preview. Teaches consequences of the mode toggle.
4. **Dry-run refresh**: "Refresh rates" opens a diff sheet (old -> new per currency, flags moves > threshold, pinned
   ones shown as "kept") with Apply / Discard, instead of silent overwrite. Fits the safety-first stance elsewhere
   in the dashboard (confirmation safety).

## RTL handling notes
- Mirror layout, sticky columns and chevrons (logical properties: `ms-/me-/ps-/pe-`, `text-start`).
- Numbers, codes, rates: `dir="ltr"` isolate, right-aligned in LTR, and in RTL align toward the numeric column
  edge consistently; put the sign first ("+0.12%"), unlike TradingView AR which puts it after.
- Sparklines do not mirror (time flows left to right even in RTL finance contexts; unverified convention, test with users).
- Currency marks never flip; Arabic names use a font with matching x-height to Latin codes.

## Anti-patterns to avoid
- Colour-only change indication (red/green) — add arrow/sign (UI-UX-Pro-Max chart guidance).
- Sign after number in RTL (TradingView AR), which breaks scanning.
- Marketing-scale hero typography around a working table (Wise/Xe heroes are for consumers).
- Eight+ numeric columns visible at once (TradingView Overview is dense; use column-set tabs).
- Silent overwrite of pinned manual rates during refresh.
- Tables that overflow the mobile viewport; use card layout at 390 (UI-UX-Pro-Max).
- Showing "stale" as a plain text column; it is an exception state and should interrupt the row's visual calm.

## Sources
- https://www.tradingview.com/markets/currencies/rates-major/ ; https://ar.tradingview.com/markets/currencies/rates-major/
- https://wise.com/gb/currency-converter/ ; https://wise.com/gb/currency-converter/usd-to-eur-rate
- https://www.xe.com/currencytables/
- https://docs.stripe.com/currencies
- https://help.shopify.com/en/manual/international/pricing/currency-formatting
- https://icflorescu.github.io/mantine-datatable/ ; https://mantine.dev/core/table/
- https://ant.design/components/table
- https://linear.app/method
- https://www.revolut.com/currency-converter/convert-usd-to-eur-exchange-rate/ (captured, not analysed in depth)
- Not captured/failed: OANDA desktop (timeout; mobile saved `ref-oanda-converter-m.png`), Airwallex (404).
- Screenshots viewed directly: xe d, tradingview d, tradingview-ar d, wise d, wise-browse d, stripe d, mantine-datatable d. Others saved but not inspected.
