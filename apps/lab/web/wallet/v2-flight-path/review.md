# Review — web/wallet/v2-flight-path   (2026-10-27)

Reviewer: ux-critic (independent). Evidence: Playwright Chromium against `http://localhost:6200/frame-web.html#/wallet/v2-flight-path`,
390 / 768 / 1440 × ar-RTL / en-LTR × light / dark (amounts shown), plus amounts-hidden runs (390 ar light, 1440 ar light,
1440 en dark), all 7 toolbar scenarios plus `error`, keyboard-only flows, `prefers-reduced-motion: reduce`, axe-core 4.x,
and a source read of every file in the version.

| Pillar | Score /10 | One-line verdict |
|---|---|---|
| Hierarchy & focus | 8 | One hero number, a labelled hold and a strong top-up panel; the cockpit holds all four business goals above the fold at 1440. |
| Task flow & speed | 7 | Top-up takes 2 actions instead of the baseline's 3, and the gap chips are clever. Keyboard users pay 12 Tab stops to reach a desktop preset, and the ledger is about 3× taller per item than the baseline. |
| Layout & responsiveness | 8 | No horizontal overflow in any of the 26 captures, CLS ≤ 0.011, sensible 390 rail and collapsed legend. Story cards waste space at 1440. |
| RTL / bilingual | 8 | Mirrored rail, isolated amounts (LRI/PDI), Arabic plurals, Latin digits and localized types are all correct. The frozen copy contradicts itself in both languages. |
| Accessibility | 6 | 44 px targets everywhere and visible 3 px rings. Focus is lost after redeeming, the filter order on desktop is illogical, one AA contrast failure, and a misleading aria-label on covered chips. |
| Visual craft & originality | 8 | A distinctive "trip fund" identity that stays within the tokens. The boarding-pass stories are excellent. The altitude encoding carries little information. |
| Motion & feedback | 8 | Restrained motion with a full reduced-motion path (0 running animations, no plane), live regions for results, and a count-up after redeeming. |

Owner goals:
- **Encourage top-ups: strong (8.5).** On desktop the refuel panel sits in the cockpit. Gap chips compute the exact top-up ("Dubai +$56.50") and fill it in. The empty state opens refuel with $50 selected. The climb preview and "After top-up $320.00" make the value concrete.
- **Trust & clarity: good but flawed (7).** Booking stories remove the baseline's "charged twice" reading, holds are explained ("Not a charge"), labels are localized and every row has a running balance. However, the running number is the *ledger* balance while the hero shows *available*, so the page shows two numbers again (B2). Frozen copy also promises auto-apply while payments are paused (B4).
- **Link to rewards: good (8).** The points strip shows ≈ USD, tier progress and an inline redeem that updates the balance, the trip chips, the points and the ledger live. The Rewards page link appears only when the customer cannot redeem.
- **Push toward booking: weakest (6).** "Book with your balance" is an outline ghost button. On desktop it sits under the hold chip and below the visual weight of the top-up CTA. Covered chips are `<button>`s that do nothing yet announce "Search this trip" (I3). Nothing in the ledger offers to book again.

## Blocking issues (must fix before approval)

**B1. Focus is lost after a successful points redemption.**
- **Where:** `parts/points-strip.tsx:50-54`, any viewport.
- **What:** `submit` calls `setOpen(false)`, which unmounts the form that contains the focused submit button. Measured: after Enter on "تحويل إلى المحفظة" at 390 ar, `document.activeElement` is `BODY`. The next Tab restarts from the top of the document.
- **Why it matters:** this is one of the four main flows (WCAG 2.4.3 Focus Order). Keyboard and screen-reader users lose their place right after a money action. The live-region message is announced, but the user is dropped.
- **Fix:** after success, move focus to the strip's "Move to wallet" trigger (keep a ref), or to the cockpit result pill (`tabIndex=-1`). Do the same for Cancel (`points-strip.tsx:165`), which also unmounts the focused button.

**B2. The running balance and the hero disagree, which recreates the "two numbers" problem the brief set out to fix.**
- **Where:** `parts/waypoint.tsx:106-107,175-177` and `parts/flight-path.tsx:450-461` (plane label). Seen in the default scenario at all viewports.
- **What:** the hero says **Available now $220.00**. The top waypoint (the $30 Istanbul hold) says **Balance after $250.00**, and the plane next to it says **Balance here $250.00**. The customer sees "$30 held → balance $250" directly under "$220 available", with nothing reconciling the two.
- **Why it matters:** the README's first listed problem is "Total vs available is unclear". This version prints the same two concepts under two near-identical labels ("المتاح الآن" vs "الرصيد بعدها"), which undermines the trust goal exactly where the design is strongest.
- **Fix (pick one):**
  - (a) Relabel the running figure as "Total incl. held" / "الإجمالي شامل المحجوز", and add one reconciling line under the hero: "$250.00 total = $220.00 available + $30.00 held".
  - (b) Show "Available after" on rows, derived as balanceAfter − active holds at that point (computable client-side from loaded stories), and keep the ledger balance only in the stub.

**B3. Amounts-hidden mode still reveals the balance range.**
- **Where:** `parts/trip-chips.tsx:64-110` and `parts/refuel.tsx:220-228` (ClimbPreview), with amounts hidden. Screenshot `review/1440-rtl-light-hidden.png`.
- **What:** with every amount masked, the chips still say **Covered** for Istanbul $184 and Jeddah $149, and **+$•••** for Dubai $276.50. That places the hidden balance between $184.00 and $276.49. The climb-preview altitude and the path's distance from the edge leak the same thing graphically.
- **Why it matters:** "amounts hidden by default" is an explicit owner decision made for privacy (shoulder-surfing, screen sharing). The chips undo it in the most prominent part of the cockpit.
- **Fix:** while `!shown`, render chips in a neutral state (price only, with "Show amounts to see what your balance covers" as the subline), and hide the climb preview's relative heights (draw a flat line). The path altitude is acceptable if the legend says so, but the chips are not.

**B4. The frozen wallet promises "Your balance is applied automatically at checkout."**
- **Where:** `parts/cockpit.tsx:209-212`, frozen scenario, all viewports (`review/scn-frozen-1440-ltr-dark.png`).
- **What:** the lock panel next to it says "Top-ups and wallet payments are paused".
- **Why it matters:** two contradictory statements about money in a restricted state. This is the exact moment the customer most needs accurate information.
- **Fix:** hide the auto-apply line when `frozen`, or swap it for "Wallet payments are paused".

## Improvements

**I1. Desktop keyboard order: high.**
- **Where:** `page.tsx:112-117` and `parts/cockpit.tsx:286`, at 1440.
- **What:** the filter chips live in an `<aside>` after the ledger, so they are Tab stops 19-23, after "Show more". A keyboard user must traverse the whole list to filter it. The refuel panel is also reached only after 8 stops (hold, book, 4 chips, points); `$100` is the 12th Tab.
- **Fix:** render the desktop filters before the `FlightPath` in the DOM and place them with grid `order`/area. Consider putting the refuel before the trip chips in the DOM at ≥1024.

**I2. Contrast failure (axe).**
- **Where:** `parts/waypoint.tsx:99`.
- **What:** `text-muted-foreground/90` on white measures 3.89:1 at 12 px ("Points redeemed" / backend description, en light).
- **Fix:** drop the `/90`.

**I3. Covered trip chips are dead buttons with a promising label.**
- **Where:** `parts/trip-chips.tsx:70-73`.
- **What:** `onClick={() => covered ? undefined : …}`, while the aria-label ends "Search this trip". Sighted users also get the same hover state as the actionable chips.
- **Why it matters:** this is the version's main "push toward booking" lever.
- **Fix:** render covered chips as `<a href>` to the pre-filled search (owner open question #1). Until then, at least drop "Search this trip" from the aria-label.

**I4. The booking CTA is underweighted.**
- **Where:** `parts/cockpit.tsx:243-253`.
- **What:** "Book with your balance" is an outline ghost button. On desktop it is the only cockpit action outside the refuel panel, and it reads as tertiary.
- **Fix:** when `available > 0` and there are covered trips, promote it (solid white or yellow fill) or merge it into the trips heading ("$220 covers 2 of your trips → Book").

**I5. The hold chip can lie.**
- **Where:** `page.tsx:45-54,65`.
- **What:** `holdCount={holds.length || 1}`, and `jumpToHold` silently returns when the RESERVE is on an unloaded page. The chip still shows a chevron and "Show the booking holding this amount".
- **Fix:** if no hold is loaded, call `loadMore` until it is found (or until `hasMore` is false), or render the chip without the chevron and the action.

**I6. Story cards are very tall.**
- **Where:** `parts/waypoint.tsx:131-219`, 1440 and 390.
- **What:** 4 entries take about 800 px at 1440 and about 1,050 px at 390. The baseline showed 4 rows in about 280 px. A single-step hold card has a 240 px stub that is mostly empty (`review/1440-rtl-light.png`).
- **Fix:** collapse the stub to an inline "Held · 18:40 · $30.00" line when a story has one step, and tighten the vertical padding. Scanning a real history (dozens of rows) is otherwise slower than the baseline.

**I7. The altitude encoding carries little information.**
- **Where:** `parts/flight-path.tsx:22-23,147-151`.
- **What:** the rail is 112 px. In the default data, balances of $0-$350 move nodes by about 80 px, and the only visible feature is the refund "dip". Below 768 px there is no altitude at all. The signature is decorative for most mobile users and needs a legend to decode on desktop.
- **Fix:** keep it, but don't rely on it. Optionally add a faint y-guide with the max-balance label, or tint the segment between nodes by direction (in/out) so the line reads without the legend.

**I8. Toggle semantics.**
- **Where:** `parts/cockpit.tsx:137-148`.
- **What:** `aria-pressed` combined with a label that flips ("Show amounts" ↔ "Hide amounts") is announced as "Hide amounts, pressed", which reads as a double negative.
- **Fix:** use a static label ("Show amounts") with `aria-pressed`, or keep the flipping label and drop `aria-pressed`.

**I9. The redeem form shows an error on its default state.**
- **Where:** `parts/points-strip.tsx:35-42`.
- **What:** an empty field shows "The minimum is 1,000 points." immediately. The empty-field branch uses a non-isolated number while line 39 uses `isolate`, which is inconsistent bidi handling.
- **Fix:** show errors only after input or blur, and isolate the number in both branches.

**I10. Web Interface Guidelines, forms.**
- **Where:** `parts/refuel.tsx:204-218` and `parts/points-strip.tsx:127-139`.
- **What:** the inputs have no `name`. The points field also lacks `autoComplete="off"` and `spellCheck={false}`.
- **Fix:** add `name`, `spellCheck={false}`, and `enterKeyHint="go"` on the amount field.

**I11. Close icon not hidden from screen readers.**
- **Where:** `parts/refuel.tsx:119`.
- **What:** the `X` icon lacks `aria-hidden`. The button has an aria-label, so this is low impact.
- **Fix:** add `aria-hidden` to the icon.

**I12. Breakpoint remounts.**
- **Where:** `parts/cockpit.tsx:74,229-286`.
- **What:** refuel is rendered in two different places switched by `useMedia('(min-width:1024px)')`. Rotating a tablet or resizing across 1024 px remounts the form and discards a typed amount. `useMedia` also calls `matchMedia` in the `useState` initializer (`parts/hooks.ts:34`), which will throw under Next.js SSR at port time.
- **Fix:** render one Refuel and move it with CSS (grid areas or `display: contents`). Make `useMedia` SSR-safe.

**I13. Masked-amount flash.**
- **Where:** `parts/hooks.ts:8-15`.
- **What:** customers who chose "shown" see `$•••.••` for one frame before the effect reads localStorage. This is acceptable in the lab, but at port prefer `useSyncExternalStore` or a cookie so SSR can render the right state.

**I14. Dark mode accent.**
- **Where:** `parts/flight-path.tsx:67`, dark mode.
- **What:** the active filter is a pale `ocean-light` slab, the brightest element below the cockpit (`review/1440-ltr-dark.png`).
- **Fix:** use `bg-secondary text-ocean-deep` to match the rest of the dark accents.

**I15. Rewards discoverability.**
- **Where:** `parts/points-strip.tsx:87-107`.
- **What:** when redemption is possible there is no link to the Rewards page (tiers and benefits).
- **Fix:** add a small text link next to the tier line.

## What is better than baseline

- **Balance shown once.** The baseline shows $250 twice (card + "الرصيد" row) and an unexplained "$0.00 reserved" row. v2 shows one $220 available number and a dashed amber "$30.00 held for 1 booking ›" chip. That chip scrolls to the holding booking and focuses it; this was verified by keyboard, and the filter resets to All.
- **No more "charged twice".** The baseline listed RESERVE −228.99 and PAYMENT −228.99 as two red rows next to an English "Refund to wallet". v2 renders one "Cairo → Dubai" boarding pass with Held / Paid / Refunded steps, a "Refunded" badge and the running balance. Every type label is in Arabic.
- **Top-up is faster.** The baseline needs amount, then the method dropdown, which stays disabled until an amount is typed, then Continue. v2 has the method preselected as a radio group, so a preset plus Continue is 2 actions. It also shows an "After top-up" value, inline range validation (BigInt cents) and a lab redirect state. The empty wallet opens refuel prefilled with $50.
- **Rewards moved inline.** In the baseline, rewards were a link in a grey footnote. v2 gives them a yellow strip with ≈ USD, tier progress and inline redemption that updates the balance, trip chips and ledger live (verified: 1,000 points → $10.00, $220 → $230, Dubai gap $56.50 → $46.50).
- **The balance now leads to trips.** The baseline had nothing connecting the two. v2 adds trip chips from the customer's own searches with exact gap top-ups, labelled as last-seen prices.
- **Better states.** Frozen, pending, done, failed (with prefilled retry and focus on submit), error and loading are all designed, and the baseline had none of these at this quality.
- **Robustness.** No horizontal overflow, console errors or targets under 44 px in any of 26 captures. Reduced motion is honoured fully.

## Screenshots

All are in `review/`:
- **Matrix:** `{390,768,1440}-{rtl,ltr}-{light,dark}.png` (full page) and `*-fold.png` (first viewport).
- **Hidden amounts:** `390-rtl-light-hidden.png`, `1440-rtl-light-hidden.png`, `1440-ltr-dark-hidden.png`.
- **Scenarios:** `scn-{empty,loading,frozen,topup-pending,topup-done,topup-failed,error}-{390-rtl-light,1440-ltr-dark}.png`.
- **Flows:** `flow-topup-preview-1440-ltr.png`, `flow-redeem-form-390-rtl.png`, `flow-redeem-done-390-rtl.png`, `flow-jump-hold-1440-rtl.png`, `flow-gap-chip-390-rtl.png`, `flow-gap-chip-1440-ltr.png`.

Measurements:
- **Overflow and CLS:** horizontal overflow was 0 px in every capture, and CLS was 0.000-0.011.
- **axe-core:** one `color-contrast` failure (I2). `page-has-heading-one` also fires, but it is out of scope because the real hero provides the H1.
- **Focus rings:** a visible 2-5 px ring on every stop, including the radio cards through `peer-focus-visible` and the amount field through `focus-within`.
- **Keyboard order:** at 390 ar the order is toggle → hold → Top up → Book → 4 chips → Move to wallet → legend → filters → View booking ×3 → Show more. This is logical.
