# Review — web/wallet/v5-flight-path   (2026-10-27, round 2)

Reviewer: ux-critic (independent). This is a fix round of `v2-flight-path`. I checked every round-1 finding in
`v2-flight-path/review.md` against the claims in `README.md` and against the running page.

**Evidence collected**
- **Tooling:** Playwright Chromium (from `F:/Goteav/web/node_modules`) against
  `http://localhost:6200/frame-web.html#/wallet/v5-flight-path`.
- **Matrix:** 390 / 768 / 1440 × ar-RTL / en-LTR × light / dark × amounts hidden / shown, which is 24 full-page captures plus 12 first-viewport captures.
- **Extra widths:** 320, 1023 and 1024 px, plus 200 % root font size.
- **Scenarios:** all 7 toolbar scenarios plus `error`, captured at 390 ar light hidden, 1440 en light hidden and 1440 en dark shown.
- **Interaction:** keyboard-only Tab order at 1440 en and 390 ar, plus these flows: redeem, cancel, redeem-all, gap chip, hold jump, resize, mobile refuel close, toggle hide after acting.
- **Motion:** `prefers-reduced-motion: reduce`.
- **Accessibility:** axe-core on 12 configurations, including open forms with errors showing.
- **Owner decision on links:** I ran the lab `search-href.ts` and the real nuqs 2.10.1 serializer (same parsers as `web/src/features/flights/search/url-state.ts`) on the same inputs.
- **Source:** I read every file in the version.

**Lab caveat:** while I tested, Vite did a full page reload about every 4 s, caused by the v6/v7 builds editing files in parallel. Every measurement was retaken after a reload. I discarded runs where `window` was replaced mid-check; that is why some captures were redone.

| Pillar | Score /10 | Delta vs v2 | One-line verdict |
|---|---|---|---|
| Hierarchy & focus | 8.5 | +0.5 | One available number, now reconciled with the total. The booking CTA is finally a primary-weight card right under the hero. |
| Task flow & speed | 8.5 | +1.5 | `$25` is Tab stop 5 (was 12). Filters come before the list. The page is 17 % shorter at 390 (2,065 → 1,711 px) and 8 % at 1440. Covered trips are real links. |
| Layout & responsiveness | 8.5 | +0.5 | 0 px overflow at 320–1440 and at 200 % text. A single refuel instance survives resize ("77" kept across 1200 → 800 → 1300). CLS ≤ 0.07, from font swap. |
| RTL / bilingual | 8.5 | +0.5 | Mirroring, LRI/PDI isolation, Arabic plurals and Latin digits are all correct. The frozen copy is now consistent in both languages. |
| Accessibility | 8 | +2 | Focus is never lost now (redeem, cancel, dismiss, refuel close). Toggle semantics are fixed. Default states pass axe. One 4.48:1 failure remains in the points error state. |
| Visual craft & originality | 8 | 0 | The identity is intact and the compact cards are cleaner. The altitude signature is still almost flat (about 9 px between $220 and $250). |
| Motion & feedback | 8 | 0 | Reduced motion gives 0 running animations and no plane. A spinner and live "Finding the booking…" on the hold chip are new and good. |

**Owner goals**

| Goal | Score | Delta vs v2 | Evidence |
|---|---|---|---|
| Encourage top-ups | 8.5 | 0 | Refuel is still inline at ≥1024 px. Gap chips fill the exact amount ("Dubai +$56.50") and focus *Continue to payment*. Empty wallet opens refuel prefilled with $50. |
| Trust & clarity | 8.5 | +1.5 | Every running figure is now *available* ("Available after $220.00" = hero). One line explains the rest: "Wallet total $250.00 = $220.00 available + $30.00 on hold". Frozen copy no longer contradicts itself. |
| Link to rewards | 8.5 | +0.5 | The "Tiers & benefits" link is added. Inline redeem updates the hero live (verified $220 → $230). |
| Push toward booking | 8 | +2 | Solid white boarding-card CTA "Book Istanbul with your balance · Covered, opens your search as it was". Covered chips are `<a href>` to the pre-filled search, same tab. The trips heading says "covers 2 of 4". |
| **Owner decision:** hidden = neutral | partial | — | The first render is clean in all 24 matrix captures and all scenarios. Two values captured while amounts were shown survive *Hide* (see NB1). |
| **Owner decision:** pre-filled search, same tab | resolved | — | The output is byte-identical to the real nuqs serializer. No `target` attribute anywhere. |

---

## Blocking issues (must fix before approval)

### NB1. *Hide amounts* does not re-mask values captured while amounts were shown

This is a regression against the owner's neutral-state decision.

**Where**
- `parts/points-strip.tsx:337` → `parts/cockpit.tsx:240,527-528` (redemption notice).
- `parts/cockpit.tsx:251-254` with `parts/refuel.tsx:77-84` (gap prefill).
- Any viewport.

**What**
1. **Redemption notice.** Show amounts, move points, then press *Hide amounts*. The result pill still reads **"2,350 points became $23.50 in your wallet."** The message is built as a string at redeem time (`onRedeemed(shown ? t.redeemed(...) : t.redeemedHidden(...))`), so it never re-renders with the live `shown`. Screenshot: `review/flow-redeem-all-hidden-390-ltr.png`.
2. **Gap prefill.** Show amounts, tap the Dubai gap chip (amount becomes **56.50**), then hide. The chips go neutral, but the refuel field keeps **$56.50** next to the visible Dubai price **$276.50**. That gives the balance exactly: $276.50 − $56.50 = $220.00. Screenshot: `review/flow-hide-after-gap-1440-ltr.png`.

**Why it matters**
- The owner decision says that when hidden, nothing reveals the balance, its range, or the points' $ value.
- The realistic moment someone presses *Hide* is right after acting, when another person walks up or a screen share starts. That is exactly when these two values are on screen.

**Fix**
- Store the notice as data (`{ points, amountUsd }`) and render it with the current `shown`. Use `redeemedHidden` while hidden.
- In `Cockpit`, when `shown` turns false and the refuel amount came from a gap request (not typed by the customer), reset the amount to `''`. Keep a `fromGap` flag on `RefuelRequest`. Alternatively, render the field value masked until shown again.
- Add both cases to the hidden-mode test list.

No other blocking issues remain. All four round-1 blockers are resolved; see the table below.

---

## Round-1 verification

| # | Round-1 finding | Status | Evidence |
|---|---|---|---|
| B1 | Focus lost after redeem / Cancel | **Resolved** | 390 ar, keyboard: after Cancel → `BUTTON "حوّلها إلى المحفظة"` (trigger), with a ring. After redeeming 1,000 points → trigger, and the hero reads $230.00. After *All points* (trigger unmounts) → the result pill (`tabIndex=-1`), and the next Tab goes to *Dismiss*. Mobile refuel *Close* → *Top up*. |
| B2 | Hero $220 vs rows/plane "balance $250" | **Resolved** | The top row reads "Available after $220.00" and matches the hero. The plane reads "Available here $220.00". The reconciling line renders while shown. `ledger.ts:75-87` walks back from `reserved` correctly against the mock (points row available after $250 = before the hold; refund story $228.99). |
| B3 | Hidden mode leaks the range | **Partial** | Default render with amounts hidden, across 12 matrix captures and 7 scenarios × 2 configurations: 0 "Covered / covers 2 of 4 / ≈ / Wallet total / Available here / to cover it" strings in the text or in any `aria-label`. The only `$` digits are trip prices, presets and limits. Node x is constant (path drawn straight). The climb preview is a fixed shape. The pending/done pills are masked. **But see NB1:** values captured while shown survive *Hide*. |
| B4 | Frozen: "applied automatically" vs "paused" | **Resolved** | Frozen shows "Wallet payments are paused." with a pause icon. The auto-apply text is absent (checked in both languages). Booking CTA and chips are hidden; points show "paused". |
| I1 | Desktop keyboard order | **Resolved** | 1440 en: toggle (1) → hold (2) → Book (3) → method (4) → **$25 (5)** → … → Continue (10) → 4 chips → Tiers link → Move to wallet (16) → **filters 17-21** → View booking 22-24 → Show more. The legend aside has no stops. |
| I2 | `/90` muted contrast | **Resolved** | axe finds no contrast violations in default, frozen, pending, failed, empty or error. There is a new failure in an error state: see I-4. |
| I3 | Dead covered chips | **Resolved** | Covered chips are `<a href="/en/flights?…">` with no `target`. The aria name is "…covered by your balance. Open the search". Gap chips stay buttons with the name "Add $56.50 to cover it". |
| I4 | Weak booking CTA | **Resolved** | 56 px solid white card with a plane tile, placed right after the hero. It names the covered trip when shown. |
| I5 | Hold chip could lie | **Resolved (code + loaded path)** | With the filter on *Points*, a click resets the filter to *All* (`aria-pressed=true`), then scrolls to and focuses `#fp-story-pay_77`. The unloaded-page loop (`page.tsx:55-70`) and the "earlier booking" / "older than the history" copy are correct by reading. The mock cannot trigger them, because the RESERVE is always on page 1. |
| I6 | Tall cards | **Resolved** | Page height at 390: 2,065 → 1,711 px. At 1440: 1,668 → 1,538 px. A single hold is now a one-line amber explanation (no empty 240 px stub). The step strip appears only on multi-step stories. |
| I7 | Altitude carries little information | **Partial (accepted as open question)** | It now encodes *available* and the legend says so. Measured node x at 1440 LTR: 203 / 213 / 206 px for $220 / $250 / $228.99. Only the refund dip is legible. |
| I8 | Toggle semantics | **Resolved** | `aria-pressed` is null. The name flips "Show amounts" ↔ "Hide amounts". |
| I9 | Error on default redeem state | **Resolved** | The field opens with 2350 and no error. Errors appear after edit or blur, and both branches isolate the number. |
| I10 | Form names / hints | **Resolved** | `name="amountUsd"` / `name="points"`, `autoComplete="off"`, `spellCheck={false}`, `enterKeyHint="go"`. |
| I11 | Close icon not hidden | **Resolved** | `aria-hidden` added. The close button is hidden at ≥1024 px. |
| I12 | Breakpoint remount / SSR `useMedia` | **Resolved** | "77" survives 1200 → 800 → 1300 px. Refuel is visible at 1024 px and collapsed at 1023 px. `useMediaQuery` uses `useSyncExternalStore` with a server snapshot of `false`. |
| I13 | Masked flash for "shown" users | **Not resolved (deferred to port, accepted)** | `hooks.ts:8-15` is unchanged. It is a lab-only concern. |
| I14 | Pale dark active filter | **Resolved** | In dark mode the active "All" chip is teal on ocean-deep (`review/1440-ltr-dark-hidden.png`). |
| I15 | No rewards link when redeemable | **Resolved** | "Tiers & benefits" → `/{locale}/account/rewards`. |

### Owner decision: search hrefs (`parts/search-href.ts` vs `web/src/features/flights/history/history-href.ts`)

I ran the real nuqs `createSerializer` (clear-on-default, same parsers and literals as `url-state.ts`) and the lab helper on the same three inputs:

| Input | Real `flightsHref` | Lab `searchHref` |
|---|---|---|
| One-way CAI→IST, 1 adult, economy | `/flights?trip=oneway&slices=CAI_IST_2026-11-14&cur=USD` | `/en/flights?trip=oneway&slices=CAI_IST_2026-11-14&cur=USD` |
| Round trip, 2 adults, children 7,4, infant aged 1, premium economy | `…trip=round&slices=CAI_IST_2026-11-14,IST_CAI_2026-11-21&adults=2&children=7,4&infants=1&infantAges=1&cabin=premium_economy&cur=USD` | identical, with locale prefix |
| 2 infants, both under 1 | `…&infants=2&cur=USD` (no `infantAges`) | identical |

- **Key order, defaults and encoding** are identical. The only difference is the `/{locale}` prefix, which next-intl `Link` adds at port.
- **Same tab:** every link is a real `<a href>` with no `target`. The lab toast shows the target, verified with "Lab · would open /en/flights?trip=oneway&slices=CAI_IST_2026-11-14&cur=USD".

**Known gaps (both documented in the README, neither blocking):**
- **No `stops=`:** the lab does not add `stops=` for `maxConnections`.
- **Mock round trips have one slice:** the mock's ROUND_TRIP searches carry a single slice, so they render as `trip=oneway`. The real `historyHref` would return `null` for such an entry.

At port, call the real `historyHref` instead of the copy.

---

## Improvements

**I-1. A $0 balance still says "Book with your balance" and "applied automatically at checkout".**
- **Where:** `parts/cockpit.tsx:260-264,389-392`, empty scenario, amounts shown (`review/scn-empty-1440-ltr-dark.png`).
- **Why it matters:** with $0.00 in the hero, both lines promise something the wallet cannot do.
- **Fix:** when `shown && available === 0n`, label the CTA "Search flights" and hide the auto-apply line. While hidden, keep the neutral label.

**I-2. The hidden empty state implies $0 (owner question).**
- **Where:** `cockpit.tsx:360` ("Your trip fund is ready for take-off. Add your first credit"), `cockpit.tsx:238` (refuel auto-opens), `flight-path.tsx:336-345` (runway copy).
- **What:** an empty history already means a zero balance, so this is structural, not a bug. Strictly, though, the hidden page still tells an onlooker "this wallet is empty".
- **Fix:** ask the owner whether onboarding copy may override the hide. If it may not, gate `fundReady` and the auto-open behind `shown`.

**I-3. Balances sit in the DOM while hidden.**
- **Where:** `parts/flight-path.tsx:235`.
- **What:** `data-balance={String(entry.availableAfter)}` is rendered on every node in hidden mode. It is not visible and not exposed to assistive tech, but it can be read in devtools, by extensions and by session-replay tools.
- **Fix:** render `data-balance` only when `shown`. The plane label is already gated, so nothing else needs it.

**I-4. Contrast failure in the points error state (axe, serious).**
- **Where:** `parts/points-strip.tsx:457`.
- **What:** `text-red-800` (#9f0712) on the yellow strip (#e7b74c) measures 4.48:1 at 12 px bold.
- **Fix:** use `text-red-900`, or put the error on a white chip.

**I-5. Redemption failure is unhandled.**
- **Where:** `parts/points-strip.tsx:334`.
- **What:** `await onRedeem(n)` has no try/catch. A rejected request leaves `busy=true` (submit disabled, "Moving points…" forever) and shows no message. The real `/loyalty/redeem` returns disabled, min/max and rate-limit errors.
- **Fix:** catch the error, reset `busy`, show the server message inline in `${ids}-preview`, and focus the field.

**I-6. A fully refunded story still headlines −$228.99.**
- **Where:** `parts/waypoint.tsx:186`.
- **What:** the Cairo → Dubai card shows "−$228.99 · Refunded". The steps explain it, but the headline still reads as a charge. That is the same reading the brief's "charged twice" complaint is about.
- **Fix:** when `refunded >= amount`, show "Net $0.00", or strike the amount the way released holds are struck.

**I-7. The altitude signature and the plane label.**
- **Where:** `parts/flight-path.tsx:144-152,452-465`, ≥768 px, amounts shown.
- **What:**
  - The scale runs from 0 to the max over 112 px, so $220 / $250 / $228.99 sit within 10 px of each other.
  - The plane label ("Available here", 74 px wide) touches the card edge at 1440, and at rest it covers the top node (`review/flow-plane-scrolled-1440-ltr.png`, `review/768-ltr-light.png`).
- **Fix:** scale over [min, max] of the loaded window instead of [0, max]. Offset the label toward the outer edge.

**I-8. An invalid top-up submit does not move focus.**
- **Where:** `parts/refuel.tsx:94-97`.
- **What:** submitting "3" shows the range error, but focus stays on the button.
- **Fix:** focus the amount input when `!inRange` (rule: "focus first error on submit").

**I-9. Frozen wallet hides booking entirely.**
- **Where:** `parts/cockpit.tsx:420,494`.
- **What:** a frozen wallet can still book with a card, but the frozen page removes the only path to search.
- **Fix:** ask the owner. Either keep a plain "Search flights" link (no "with your balance"), or accept the current behaviour.

**I-10. Layout shift from font swap at 768.**
- **Where:** trip chips and the filter row, 768 px.
- **What:** CLS is 0.045–0.07 at 768 ar dark (sources: `LI.shrink-0` trip chips and the filter buttons, about 3 s after load, from Tajawal swapping in). It is ≤ 0.012 elsewhere.
- **Fix at port:** preload the font with `<link rel="preload" as="font">` and keep `font-display: swap`.

**I-11. Copy and wrapping polish.**
- At 390 en, "Tiers & benefits" wraps mid-link (`points-strip.tsx:373`). Add `whitespace-nowrap`.
- Add `translate="no"` to IATA codes and booking refs (`trip-chips.tsx:100`, `waypoint.tsx:168`).
- The placeholder "0.00" could read "e.g. 50…".

**I-12. Lab-only notes for the port.**
- `LabLink` always calls `preventDefault`, so Ctrl/middle-click are blocked in the lab only. Make sure next-intl `Link` replaces it.
- `formatUsd` hand-formats instead of using `Intl.NumberFormat`, which accepts BigInt. That is acceptable because Latin digits are deliberate.
- The filter is not reflected in the URL (`?filter=`). It is optional.

---

## What is better than baseline (v1) and v2

- **One trustworthy number.**
  - The baseline printed $250 twice and showed an unexplained "$0.00 reserved".
  - v2 printed $220 in the hero but "$250 after" in the rows.
  - v5 prints $220 everywhere a running figure appears, and explains the $250 in one sentence.
- **Booking is a real path.**
  - The baseline had nothing; v2 had a ghost button and dead chips.
  - v5's CTA and covered chips open the customer's own search, pre-filled exactly as the real site would (verified against nuqs).
- **Faster keyboard top-up.** The baseline needs amount → (disabled) method → Continue. v5 reaches `$25` in 5 Tabs on desktop and in 3 on mobile (Top up, Enter, preset).
- **Shorter history.**
  - v5 shows 4 movements in about 500 px at 1440. v2 needed about 800 px; the baseline showed 4 flat rows.
  - The "charged twice" reading is gone.
- **Privacy by default.** Amounts start hidden. Chips, points, path, plane, preview and the total line all go neutral on first render. Only NB1's carry-over remains.
- **Robustness.**
  - 0 px horizontal overflow in every capture.
  - No console errors.
  - No interactive target under 44 px, apart from the inline "Tiers & benefits" text link (18 px, covered by the inline exception).
  - Reduced motion leaves 0 running animations.
  - axe passes in default, frozen, pending, failed, empty and error states. `page-has-heading-one` fires but is out of scope, because the real hero owns the H1.

## Screenshots

All are in `review/`.

- **Matrix:**
  - `{390,768,1440}-{rtl,ltr}-{light,dark}.png` (amounts shown, full page) and `*-fold.png` (first viewport).
  - `{390,768,1440}-{rtl,ltr}-{light,dark}-hidden.png` (amounts hidden, the default).
  - `320-rtl-light.png`.
- **Scenarios:** `scn-{empty,loading,frozen,topup-pending,topup-done,topup-failed,error}-{390-rtl-light-hidden,1440-ltr-light-hidden,1440-ltr-dark}.png`.
- **Flows:**
  - `flow-redeem-form-390-rtl.png`, `flow-redeem-done-390-rtl.png`, `flow-redeem-all-hidden-390-ltr.png` (NB1)
  - `flow-gap-chip-1440-ltr.png`, `flow-hide-after-gap-1440-ltr.png` (NB1)
  - `flow-book-cta-toast-1440-ltr.png`, `flow-jump-hold-1440-ltr.png`, `flow-plane-scrolled-1440-ltr.png`

## Verdict

v5 is a real fix round, not a cosmetic one.
- All four v2 blockers are resolved, and 13 of 15 improvements are resolved. I7 is partial by design; I13 is deferred to the port.
- The owner's link decision is implemented to the byte.
- The booking goal moved from the weakest pillar to a solid 8.

One owner decision is not fully met: *Hide amounts* does not re-mask two values captured while amounts were shown. Those are the redemption notice ($23.50) and a gap-chip prefill that lets anyone compute the balance from a visible trip price. Both are small, local fixes in `points-strip.tsx` / `cockpit.tsx` / `refuel.tsx`.

**Ready for owner approval once NB1 is fixed.** I-1, I-2 and I-9 are product questions to put to the owner alongside it, and they do not block.
