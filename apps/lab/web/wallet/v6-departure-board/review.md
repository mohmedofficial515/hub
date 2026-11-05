# Review — web/wallet/v6-departure-board   (2026-10-27, round 2)

Reviewer: independent UX critic. This is a fix round of `v3-departure-board`. Inputs: `../v3-departure-board/review.md`
(round 1), this version's `README.md`, and the brief `../README.md`, including "Owner decisions after review round 1".
Evidence comes from the lab frame (`frame-web.html#/wallet/v6-departure-board`) driven by Node Playwright (Chromium) with
axe-core 4.x, plus a read of every file in `parts/` and `page.tsx`. Captures:
- 390 / 768 / 1440 × ar / en × light / dark × amounts hidden / shown (24 shots).
- All 9 scenarios at 1440 en light (hidden + shown), 390 ar dark (hidden + shown) and 768 ar light (shown) (45 shots).
- Keyboard flows, focus crops, pill behaviour and goal cards.

All captures use a tall viewport, not `fullPage`, so split-flap tiles are not caught mid-flip. Other agents were editing
v5 and v7 at the same time, so the scripts dropped any run that saw a Vite reload and retried it.

| Pillar | Score /10 | Delta vs v3 | One-line verdict |
|---|---|---|---|
| Hierarchy & focus | 8 | = (8) | One focal board. A covered row's primary teal "Book with balance" now carries the decision. The mobile "Top up" pill is navy on the navy board and nearly disappears. |
| Task flow & speed | 8 | +1 (7) | Reveal, Add-gap and redirect keep focus where they should. The pill reaches the amount field in one tap. The gate itself is now *lower* on phones than in v3. |
| Layout & responsiveness | 8 | +2 (6) | B1 is fixed. No overflow in 69 captures. The table fits beside the gate at xl. Hidden mobile cards wrap price and actions onto two lines (160–178 px each), which is not what the README describes. |
| RTL / bilingual | 8 | = (8) | Copy fixes landed (رحلات المغادرة, اكتمل, ما يمكن لرصيدك شراؤه). The Arabic trip line leaves an orphan "·" at the end of a line. The summary sentence "(4)" is awkward. |
| Accessibility | 8 | +2 (6) | B2 and B3 are fixed. axe reports 0 violations in 8 states, 0 text-contrast failures, and every target is ≥ 44 px. Small gaps remain: the pill sits at tab stop 30, masked amounts are read as bullets, and the pill can sit over focused controls. |
| Visual craft & originality | 8 | = (8) | Word tiles ("GATE" "CLOSED") and the single "$ •••••" tile read as intended. Repetition is the main weakness: "PAY BY CARD" ×4 when frozen and "NEED $190.00" beside "$190.00" in the empty state. |
| Motion & feedback | 8 | = (8) | Flips settle in about 180 ms. Reduced motion gives 0 transforms and stops the pulse. The redeem error and redirect feedback are clear. The goal bar animates `width`. |
| **Overall** | **8.0** | **+0.7 (7.3)** | |

## Blocking issues (must fix before approval)

**None.** All three round-1 blockers are resolved, with evidence below. Both owner decisions are implemented correctly:
in the hidden state nothing reveals the balance, and the search links match the real web format. The items under
"Should fix before port" are real, but none stops the owner from approving the concept.

## 1. Round-1 findings: verification

### Blocking
| # | Status | Evidence |
|---|---|---|
| B1 standby squeeze at 390 | **Resolved** | The text box measures **300 × 66 (en)** and **300 × 46 (ar)**, against 62 × 232 / 101 × 108 in v3. The button spans the full width below `sm` (`parts/departure-board.tsx:331-352`). See `review/390-ltr-light-hidden-board.png` and `review/390-rtl-light-hidden-board.png`. |
| B2 focus lost on reveal | **Resolved** | Enter on "Show balance & match trips" leaves `activeElement` = `P` "Your balance covers 2 of 4 trips." (ar: "رصيدك الحالي يغطي رحلتين من 4."). The next Tab lands on "Book with balance · Istanbul". There is no scroll jump (`:294-304, 357-367`). See `review/flow-reveal-1440-en-light.png`. |
| B3 light focus ring < 3:1 | **Resolved** | The computed ring is `rgb(31, 50, 92) 0 0 0 5px` (3 px plus a 2 px offset) on presets, submit and the log filters in light mode, and teal `rgb(45,178,185)` in dark. The radio shows a navy ring, the selected radio shows a navy border plus a check badge, and the two look distinct (`review/focus-1440-ltr-light-radio.png`). The amount field has a navy border plus a 3 px ring (`review/focus-1440-ltr-light-amount.png`). |

### Improvements
| # | Status | Evidence / note |
|---|---|---|
| 1 Gate far down on phones | **Partial** | The pill works: it shows at load (390 × 844), hides once any pixel of the gate is visible, and a tap focuses `amountUsd` (y = 125) and hides the pill. **But the gate is now lower than in v3:** 1,343 px at 390 ar light hidden (v3: 1,120), 1,158 px in en, and 1,217–1,250 px when shown. The cause is the new trip line and the two-line hidden cards. See §3. |
| 2 Hidden default kills the board | **Superseded (owner)** | The neutral state is implemented as decided (§2). |
| 3 "Short" has no word | **Resolved** | A visible "NEED / ينقصك" label over the gap. The SR text reads "Needs $56.50 more". |
| 4 Prices rounded up | **Resolved** | `$276.50` on the board and in SR text. The ceiling is used only for "Add $57". |
| 5 Goal pin unlabelled | **Resolved** | The label is visible on mobile cards and from md. The name "Goal: Dubai" contains the visible "Goal". `aria-pressed` toggles. |
| 6 Redeem failure | **Resolved** | `?scenario=redeem-error`: focus moves to the `role=alert` "We couldn't convert your points and none were used. Try again." The button becomes "Try again", and the retry ends in "$23.50 added to your balance — board updated", which takes focus. See `review/flow-redeem-error-1440-en.png`. |
| 7 Points $ masked | **Superseded (owner)** | Hidden: count only, the preview reads "Value shows with amounts", and the confirmation reads "Points added to your balance — board updated". |
| 8 Submit loses focus | **Resolved** | After Enter, focus stays on the button, now named "Taking you to the payment page…", and the `role=status` carries the same text (`review/focus-1440-ltr-light-submit-redirecting.png`). |
| 9 City SR text uppercased | **Resolved** | `srText={r.city}` (`departure-board.tsx:407`). |
| 10 Huge story accessible name | **Resolved** | Uses `aria-labelledby` plus `aria-describedby`. New nit: in the hidden state the name includes "$•••••" (see I-6). |
| 11 Unlabelled second log amount | **Resolved** | "Bal. $250.00" / "الرصيد" (`review/390-ltr-light-shown.png`). |
| 12 Two "Points" controls | **Resolved** | The slider is named "Points slider". |
| 13 Muted-on-muted 4.35–4.43:1 | **Resolved** | 0 text-contrast failures (axe plus a composited computed check) in 8 states. |
| 14 40–42 px targets | **Resolved** | Nothing under 44 px. The only exception is the 40 px-tall amount `<input>`, which sits inside a fully clickable 71 px wrapper. |
| 15 Amount padding not clickable | **Resolved** | The wrapper focuses the input. It is a `<div onClick>` (`gate.tsx:125-133`); a `<label htmlFor>` would be cleaner (Web Interface Guidelines anti-pattern: a div with a click handler). |
| 16 Arabic copy | **Resolved** | |
| 17 Board title | **Resolved** | "What your balance can buy". |
| 18 Slider forced LTR | **Accepted** | Kept on purpose and documented. |
| 19 "G a t e  c l o s e d" | **Resolved** | "GATE" "CLOSED" and "PAY" "BY" "CARD" as word tiles (`review/scn-frozen-1440-ltr-light-hidden.png`). |
| 20 Six-tile mask | **Resolved** | One "$ •••••" tile. |
| 21 Story titles truncate at 768 | **Resolved** | Two lines below lg (`review/768-rtl-light-shown.png`, "فندق في إسطنبول · ليلة واحدة"). |
| 22 Input `name` | **Resolved** | `amountUsd`, `method`, `points`, with `autoComplete="off"`. |
| 23 Placeholder | **Resolved** | "100…" in a lighter tone. |
| 24 Filter in URL | **Not resolved (deferred to port)** | Acceptable in the lab. It must be part of the port plan (nuqs `?filter=`). |
| 25 `touch-action` | **Resolved** | `touch-manipulation` on `<main>`. |

**Regressions:** the gate is deeper on 390 ar (+223 px against v3). Hidden mobile cards are 160–178 px tall because
price and actions wrap onto separate lines (`departure-board.tsx:457-479`); the README says they share one line.

## 2. Owner decisions: verification

**Hidden = fully neutral: verified.** For every hidden capture (12 matrix combinations plus 9 scenarios), the script
searched the full `main` textContent (including `sr-only`) and every `aria-label`, `aria-valuetext`, `aria-valuenow` and
`title` for: 220, 250.00, $30.00, 23.50, 56.50, 57, %, Need, Covered, With top-up, Book with balance, ينقصك, مغطّاة,
مع الشحن, احجز برصيدك. The only hit was the standby copy itself ("…what the rest need"), which is generic. Per surface:
- Status column: removed, not masked. The header reads "LAST SEEN" with no "· STATUS" (`:272, 391`).
- Gap amounts and Add buttons: absent.
- Button weight: every row shows the same outlined "Check price" (`review/1440-ltr-dark-hidden.png`).
- Points: shows "2,350 pts" with no ≈ $.
- Hold chip: reads "1 booking on hold".
- Goal: price only, no fill, `aria-valuenow` removed, `aria-valuetext` "Show amounts to see progress" (`review/flow-goal-1440-en-hidden.png`).
- Live region: empty while hidden.
- Gate "Balance after top-up": `$•••••`.
- Log: amounts and month totals masked.

Two small notes, neither a leak:
- Frozen + hidden shows "PAY BY CARD" on every row. This is the same for every balance, so it reveals nothing.
- The hidden goal card still draws an empty grey track. A sighted user can read it as "0 %". Use a dashed or hatched
  track, or drop the track while hidden.

**Search hrefs: verified.** The real nuqs `createSerializer` (from `F:/Goteav/web/node_modules/nuqs`) was run with the
real parser set from `src/features/flights/search/url-state.ts`. It produces
`/flights?trip=round&slices=CAI_IST_2026-11-14,IST_CAI_2026-11-21&cur=USD`, and the lab renders
`/en/flights?trip=round&slices=CAI_IST_2026-11-14,IST_CAI_2026-11-21&cur=USD`.

Parity checks:
- Key order matches: trip, slices, adults, children, infants, infantAges, cabin, cur.
- Defaults are omitted (`adults=1`, `cabin=economy`), as nuqs `clearOnDefault` does.
- Non-default values serialize as `adults=2&children=7,4&infants=1&infantAges=1&cabin=premium_economy` in both.
- Locale prefix: `/{locale}/flights` matches the site's routing (`localePrefix: 'always'`).
- All links open in the same tab (no `target`).

Port notes:
- The real `historyHref` also adds `stops=` from `maxConnections` (`history-href.ts:22-23`). The lab mock has no
  `maxConnections`, so the port must use `historyHref`, as the README already plans.
- `historyHref` returns `null` for departed entries. These are filtered out today (`departure-board.tsx:168`), which is
  fine.

## 3. Mobile path to the gate, and whether to show fewer rows

Measured at 390 × 844:

| | Gate top | Submit bottom | Board height | Card height |
|---|---|---|---|---|
| ar hidden | 1,343 | 1,812 | 1,015 | 162–178 |
| en hidden | 1,158 | 1,627 | 830 | 160–170 |
| en shown | 1,217 | 1,686 | 893 | 161–169 |

The floating pill does its job. It is visible at load, one tap scrolls to the gate and focuses the amount field, and it
hides as soon as the gate shows. Weaknesses:
- **It is camouflaged.** It is `bg-primary-dark` floating over the `bg-primary-dark` board, which is where it sits for
  the first ~1,000 px of scroll. The edge contrast is about 1:1 apart from a `ring-white/10` hairline and a shadow. Only
  the teal "+" disc stands out (`review/pill-390-rtl-light-hidden-scrolled.png`).
- **It sits over row actions.** After 250 px of scroll it covers "Check price · London" and "Goal: London" (ar), and
  "Book with balance · Jeddah" and "Goal: Jeddah" (en).
- **It is reached late by keyboard.** It is the last element in `<main>` (`page.tsx:126`), so it is tab stop 30–31,
  after the gate it points to.

**Fewer rows on mobile: yes.** Four full cards cost 680–710 px before the gate. On a phone the board is a teaser, and
the full list is one tap away. Recommendation:
- Below md, show **3 rows** (the goal row first if pinned, then by search date), with "Show all 4 trips" under them.
- Make hidden cards one line (price + action) as the README intended. Either shorten the action to the icon-only link
  plus "Goal" below `sm`, or put the price beside the city.

Together these bring the gate to about 800–850 px at 390, so it is in reach within one scroll even without the pill.
Keep the pill, but restyle it in the teal or yellow accent so it contrasts with the board.

## Should fix before port (not blocking approval)

1. **Pill contrast and overlap** (`parts/mobile-top-up-bar.tsx:441-450`, 390 and 768–1279, both themes). Use
   `bg-secondary text-primary-dark` (or the yellow `secondary-foreground`) so it stands out on the navy board and on the
   light page. Add `scroll-padding-bottom: 6rem` on the scroll root below xl, so a focused row action is never under the
   pill (guideline: overlays must not cover the focused element).
2. **Mobile length** (`departure-board.tsx:445-483`, 390, all modes). Use 3 rows plus "Show all", and one-line hidden
   cards (§3). Without this the gate on phones is still later than in v3.
3. **Pill DOM position** (`page.tsx:126`). Render it right after `<StatusBar>`, or give the status bar a visually quiet
   "Top up" link below xl, so keyboard and switch users reach it before the board, not after the log.
4. **Curated links promise a city they do not search** (`departure-board.tsx:188-196`, empty scenario). "Search flights ·
   Istanbul" opens a blank `/en/flights`. Either pre-fill the destination (needs a URL parameter on the real search) or
   label it "Search flights" and leave the city out of the accessible name.

## Improvements

5. **Empty-state duplication** (`departure-board.tsx:509-519`, scenario `empty`, all viewports). With a $0 balance every
   row shows "$190.00 · NEED $190.00 · Add $190". When the gap equals the price, drop the NEED line and keep "Add $190"
   (`review/scn-empty-390-rtl-dark-shown.png`).
6. **Masked amounts read as bullets** (`parts/flight-log.tsx:280-284`, hidden). The story's `aria-labelledby` text
   includes "$•••••", which screen readers may read as "dollar bullet bullet…". Use `t.hiddenStatus` ("Hidden") as the
   SR text for masked log amounts, as the status bar already does.
7. **Frozen repetition** (`departure-board.tsx:503-504`). "PAY BY CARD" ×4 repeats the summary line "Wallet frozen: pay
   by card when you book." Drop the status column while frozen (the summary covers it), or show it once.
8. **Arabic trip line orphan** (`departure-board.tsx:211-222`, 390 ar). "ذهاب وعودة · مسافر واحد ·" breaks before
   "اقتصادية", leaving a trailing dot. Wrap each segment in `whitespace-nowrap`, or at 390 use `split` mode as in the
   table.
9. **Arabic summary phrasing** (`i18n.ts`, `summaryNone`). "لا يغطي أيًا من الرحلات (4) بعد" reads like a form label.
   Use "رصيدك الحالي لا يغطي أي رحلة من الرحلات الأربع بعد" or "… أيًا من 4 رحلات بعد".
10. **Hidden redeem confirmation says "board updated"** (`i18n.ts` `redeemDoneHidden`). While hidden the board does not
    change. Use "Points added to your balance."
11. **"Book with balance" lands on search results** (`departure-board.tsx:558-567`). This is acceptable per the owner,
    but add a description (`aria-describedby` or `title`): "Opens flight search with this trip; price may have
    changed", so the label does not promise a booking step that does not happen.
12. **Summary is both focused and live** (`departure-board.tsx:357-367`). Some screen readers will read the sentence
    twice after reveal (once on focus, once from the live region). Suppress the live update for that one set, for
    example by setting `announced` before mount without `aria-live` on the first render.
13. **Goal bar animates `width`** (`parts/trip-goal.tsx:360-364`). Animate `scaleX` with `origin-left rtl:origin-right`
    (guideline: animate only transform and opacity).
14. **Reveal layout shift.** The standby strip (≈ 100 px) collapses to the 53 px summary, so the gate column and the log
    jump about 40 px at xl. Give the strip and the summary the same `min-h`.
15. **Log filter not in the URL.** Deferred to the port (round-1 item 24). Keep it on the port checklist.

## How well it serves the four owner goals

| Goal | v6 verdict | Delta vs v3 | Evidence |
|---|---|---|---|
| G1 Encourage top-ups | **Strong on desktop, good on mobile** | ↑ | "Add $57" fills the gate, focuses submit and announces "With $57.00 more you cover 3 of 4 trips". Enter keeps focus while redirecting. The pill offers one-tap access on phones. Held back by the camouflaged pill and a deeper gate on mobile. While hidden, the board no longer pulls toward top-up; this is the owner's choice. |
| G2 Trust & clarity | **Strong** | ↑ | Exact cents everywhere. The neutral hidden state cannot mislead. The redeem failure says "none were used". The redirect status is announced. The trip line (round trip · 1 traveller · Economy) says exactly what the link will search. |
| G3 Link to rewards | **Good** | = | The inline convert works and is error-safe. While hidden, the $ value is gone (owner decision), so the hook is weaker in the default state, as the owner chose. |
| G4 Push toward booking | **Good → strong** | ↑ | Covered rows lead with a primary teal "Book with balance" into the *real* pre-filled search, verified against nuqs. The goal card offers "Book with balance" when reached. The curated fallback links are generic (item 4). |

## What is better than baseline

Baseline: `../v1-baseline/owner-1920-rtl-light.png`. Everything listed in round 1 still holds: one balance instead of
two, story-grouped ledger instead of an apparent double charge, localized titles, inline rewards, a link between balance
and trips, and full state coverage. v6 adds:
- **Booking is one tap from a trip the customer already searched,** and lands on the real results page with route,
  dates, travellers and cabin intact. The baseline has no route from the wallet to booking.
- **Top-up on desktop takes 2 actions** (preset, then Continue) with the card preselected. From the board it is 2
  keystrokes (Add $57, then Enter). The baseline needs amount, then method (disabled until an amount is typed), then
  submit.
- **Privacy is stronger than the baseline.** The baseline's hidden mode only masks the card number. v6 hides the
  balance everywhere, including derived signals.
- **Where the baseline is still better:** on a phone its top-up form sits closer to the top. v6 depends on the pill to
  close that gap, which is why §3 matters.

## Screenshots

All are in `review/`. "hidden" and "shown" refer to `wallet.balance.shown`. All are tall-viewport renders.
- Matrix (24): `{390|768|1440}-{rtl|ltr}-{light|dark}-{hidden|shown}.png`
- Standby fix (B1): `390-ltr-light-hidden-board.png`, `390-rtl-light-hidden-board.png`
- Focus (B3): `focus-1440-ltr-{light|dark}-{preset|radio|amount}.png`, `focus-1440-ltr-light-submit-redirecting.png`
- Flows: `flow-reveal-1440-{en|ar}-light.png`, `flow-add57-1440-en-light.png`, `flow-redeem-error-1440-en.png`,
  `flow-goal-1440-en-{hidden|shown}.png`
- Mobile pill: `pill-390-rtl-light-hidden-{load|scrolled|after}.png`, `pill-390-ltr-dark-shown-{load|scrolled}.png`,
  `pill-1024-ltr-light-hidden-load.png`
- Scenarios (45): `scn-{default|empty|loading|frozen|topup-pending|topup-done|topup-failed|error|redeem-error}-{1440-ltr-light|390-rtl-dark}-{hidden|shown}.png`,
  `scn-*-768-rtl-light-shown.png`

Measured facts:
- Horizontal overflow: none in 24 matrix and 45 scenario captures.
- Console: 0 errors or warnings in every run.
- axe-core: 0 violations at 1440 en light (hidden and shown), 1440 ar dark, 390 ar light hidden, 390 en dark, frozen,
  empty and topup-failed.
- Contrast: 0 text failures (composited computed colours).
- Targets: none under 44 × 44, apart from the wrapped amount input.
- Flip timing: 3 tiles in motion right after typing $100, settled in about 180 ms. Reduced motion: 0 transforms, pulse
  `animation-name: none`.
