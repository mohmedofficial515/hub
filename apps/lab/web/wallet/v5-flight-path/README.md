---
version: v5-flight-path
title: Flight path (fix round)
status: review # draft | review | approved | rejected | ported
base: v2-flight-path
created: 2026-10-27
tokens: inherit # inherit | override (see tokens.css)
touches-components: [] # wallet-only: replaces features/account/wallet/{balance-card,top-up-card,wallet-history}.tsx and recomposes wallet-settings.tsx; no shared component is changed. Reuses (at port) features/flights/history/history-href.ts for the pre-filled search links.
ported: # branch / commit once ported
---

# Flight path (fix round)

## Idea
Same layout principle as v2: the wallet is one vertical flight path. The **cockpit** at the top shows "now":
one available number, the labelled hold, an in-place top-up (refuel), the trips the balance covers and the
points strip. Below it every movement is a **waypoint** on a path whose distance from the edge follows the
balance. This round fixes all four blocking issues from v2's review and applies the owner's decisions from
review round 1:
- Every running figure on the page is now **available**, the same concept as the hero.
- Hidden amounts produce a **neutral** page.
- "Book with your balance" and the covered chips open the **real pre-filled flight search**.
- The ledger is about 40 % shorter.

## Review findings and how they were resolved

### Blocking

| # | Finding (v2 review) | Resolution in v5 |
|---|---|---|
| B1 | Focus was lost after a redemption and after Cancel, because the form unmounted. | `PointsStrip.close()` returns focus to the "Move to wallet" trigger after Cancel and after success. When the trigger is gone (all points moved, or the balance is now below the minimum), focus goes to the cockpit result pill (`tabIndex=-1`). Dismissing the pill moves focus to the "Available now" heading. Closing refuel on mobile moves focus back to "Top up". Verified by keyboard: after Cancel or Redeem the active element is the trigger; after "All points" it is the result pill. |
| B2 | Two balances: the hero showed $220 available while the rows and the plane showed "Balance after/here $250". | Every running figure is now **available after** (`ledger.availableAfterById`): balance − holds at that point. It is anchored on the server's current `reserved` and walked backwards, so it is exact for every loaded page. The top row reads "Available after $220.00", which matches the hero. The plane reads "Available here", and the path altitude follows available too. One reconciling line under the hero explains the remaining number: "Wallet total $250.00 = $220.00 available + $30.00 on hold". The ledger `balance` is no longer printed on any row. |
| B3 | Hidden mode leaked the balance range (Covered / +$gap chips, climb heights, path altitude). | **Neutral state** (owner decision). While amounts are hidden: <ul><li>chips show the price only, with a search icon, and every chip opens its search</li><li>the subline says "Show amounts to see what your balance covers"</li><li>the "covers 2 of 4" count is not rendered</li><li>the booking CTA does not name a covered trip</li><li>points show the count with no ≈ $ value, and the redeem preview says "Show amounts to see the value"</li><li>the success message has no amount</li><li>the path is drawn straight, and the legend says why</li><li>the plane has no read-out</li><li>the climb preview is a fixed illustration</li><li>the "wallet total" line is not rendered</li></ul> Verified: 0 Covered labels, 0 gap buttons, no ≈, no plane label, and the only `$` digits on the page are trip prices and top-up presets. |
| B4 | The frozen wallet said "applied automatically at checkout" next to "payments are paused". | When the wallet is frozen, the auto-apply line becomes "Wallet payments are paused" (pause icon), the booking CTA and trip chips are hidden, and points show "paused". |

### Owner decisions (review round 1)

| Decision | Resolution |
|---|---|
| Hidden = neutral state | See B3. |
| Covered chip and "Book with your balance" open the pre-filled flight search in the same tab | `parts/search-href.ts` mirrors the real `historyHref(entry)` → `flightsHref(criteriaOfEntry(entry))` in `web/src/features/flights/history/history-href.ts` and `search/url-state.ts`: `/{locale}/flights?trip=round&slices=CAI_IST_2026-11-14,IST_CAI_2026-11-21&adults=2&children=7,4&infants=1&infantAges=…&cabin=business&cur=USD`. Defaults are omitted the way the nuqs serializer omits them (adults=1, no children, infants=0, cabin=economy); `cur` is the last-seen-price currency. Links are real `<a href>` (same tab, no `target`). In the lab a click shows a toast with the target URL, because the frame cannot open site routes. |
| Stronger "Book with your balance" (push-toward-booking scored 6) | It is now a solid white boarding-card button (min 56 px) with a plane tile, next to Top up on mobile and directly under the hero on desktop. When amounts are shown and a search is covered, it reads **"Book Istanbul with your balance · Covered, opens your search as it was"** and links to that search. Otherwise it reads "Book with your balance · Opens your latest search to Istanbul" (or the flight search page when there are no searches). The trips heading adds "Your balance covers 2 of 4". |

### Improvements

| # | Finding | Resolution |
|---|---|---|
| I1 | Desktop keyboard order: filters came after the list, and refuel came late. | There is one horizontal filter row **before** the list at every width; the legend aside is non-interactive. The cockpit DOM order is now header → balance → Book → **refuel** → trips → points, so at 1440 "$25" is Tab stop 5 (it was 12) and the filters come before every "View booking". |
| I2 | `text-muted-foreground/90` contrast. | Removed (the description now sits in the meta line at full muted). axe-core reports no violations at 1440 en light / 1440 ar dark / 390 ar light hidden / 390 en dark. |
| I3 | Covered chips were dead buttons labelled "Search this trip". | They are now links to the pre-filled search (see above). Gap chips stay buttons that fill refuel ("Add $56.50 to cover it"). |
| I4 | The booking CTA was underweighted. | See "Stronger Book with your balance". |
| I5 | The hold chip could promise a jump to an unloaded booking. | Clicking it loads pages until the RESERVE appears. The chip shows a spinner and a live "Finding the booking…" message while it searches, and "older than the history available" if the history ends first. The count is never invented: with no hold loaded it says "on hold for an earlier booking". |
| I6 | Ledger cards were about 3× the baseline height, and single-step cards had an empty stub. | The cards are compact: one row with icon, title, meta (kind · ref · date · time), amount and status, and a footer with "Available after" and View booking. The perforated step strip appears **only** when a booking has more than one step; a single hold gets a one-line amber explanation instead of a 240 px stub. 4 entries now take about 500 px at 1440 (v2: about 800) and about 530 px at 390 (v2: about 1,050). |
| I7 | The altitude carried little information. | It is kept as the signature, but it now encodes the hero's concept (available, including the hold dip), and the legend says so. It is not relied on: every row prints the figure. A y-guide and segment tinting were not added (open question). |
| I8 | Toggle semantics ("Hide amounts, pressed"). | The visible label flips and is the accessible name; `aria-pressed` is removed. |
| I9 | The redeem form showed an error on its default state, with inconsistent isolation. | Errors appear only after editing, blur, "All points" or submit. Both branches isolate the number. Submit is no longer disabled on invalid input; it reveals the error instead. |
| I10 | Forms lacked names and hints. | `name="amountUsd"` and `name="points"`, `spellCheck={false}`, `autoComplete="off"` and `enterKeyHint="go"` on both fields. |
| I11 | The X icon was not hidden from screen readers. | `aria-hidden` is added. The close button is hidden at ≥ 1024 px, where refuel is always open. |
| I12 | Breakpoint remounts and SSR-unsafe `useMedia`. | There is **one** `Refuel` instance. The cockpit is one grid whose two left-column wrappers are `display: contents` below 1024 px and flex columns above; refuel moves to the right column with CSS only, and its collapse on mobile is `max-lg:hidden` (no unmount). Verified: "77" typed at 1200 px survives 800 px and then 1300 px. `useMedia` is replaced by a hydration-safe `useMediaQuery` (`useSyncExternalStore`, server snapshot `false`), used only for SVG geometry. |
| I13 | Masked-amount flash for "shown" customers. | Unchanged in the lab (port note: read the preference with `useSyncExternalStore` or a cookie). |
| I14 | The dark active filter was a pale slab. | It is now `dark:bg-secondary dark:text-ocean-deep`. |
| I15 | No Rewards link when redemption is possible. | A "Tiers & benefits" link is added after the tier line → `/{locale}/account/rewards`. The "Rewards" link stays when the customer cannot redeem. |

## Key decisions (new in v5)
- **Available after, not balance after.** The backwards walk from the current `reserved` is exact without any
  extra API call. A RESERVE reduces available; a CAPTURE/RELEASE consumes the hold. The month in/out totals still
  use ledger movements only (holds are not money in or out).
- **Booking CTA choice:** the newest search the balance covers, else the newest search, else `/flights`. It is
  computed without coverage while amounts are hidden.
- **Lab links** (`parts/lab-link.tsx`): a real `href`, with a click intercepted into a toast that shows the target.
  At port this becomes next-intl `Link` (which adds the locale itself, so drop the `/{locale}` prefix and call the
  real `historyHref`).
- Booking links point to `/{locale}/account/bookings/{ref}`, which is a placeholder until the backend adds
  `bookingId` to wallet references (owner decision, port plan).
- Everything else carries over from v2 unchanged: BigInt money, LRI/PDI isolation, every state (default, empty,
  loading, frozen, topup-pending/done/failed, plus version-local `error`), motion, and the reduced-motion path.

## Verification (Playwright Chromium, lab at :6200)
- Matrix: 390 / 768 / 1440 × ar / en × light / dark × amounts shown / hidden (24 captures), plus 1023 / 1024 px,
  with no horizontal overflow and no interactive target under 44 px.
- Scenarios: all 7 toolbar scenarios plus `error`, at 390 ar light and 1440 en dark. No page errors.
- Flows:
  - keyboard order at 1440
  - redeem, cancel and redeem-all focus
  - gap chip → amount 56.50 with focus on "Continue to payment"
  - chip and CTA hrefs and the lab toast
  - typed amount kept across 1024 px
  - mobile refuel close → focus on Top up
  - hold jump with the filter set to Points → focus on the hold card
- Reduced motion: 0 running animations and no plane.
- axe-core: clean on 4 configurations.
- `pnpm typecheck` passes.
- Screenshots (amounts shown): `shots/1440-rtl-light.png`, `shots/1440-ltr-dark.png`, `shots/768-ltr-light.png`,
  `shots/390-rtl-dark.png`.

## Open questions
- **Round-trip searches in the mocks** have one slice. The real `validCriteria` would reject them, and `historyHref`
  would return null. The lab derives the trip type from the slice count (`search-href.ts`). At port, real entries
  carry both slices.
- **`maxConnections`** is not in the mock search entry. The real `historyHref` adds `stops=` for it, so use the
  real helper at port.
- **Curated destinations** (no searches) link to `/flights` with no criteria. Should they pre-fill the
  destination (for example with `slices=CAI_IST_<date>`), and with which date?
- **Altitude:** should the path get a faint max-available guide or in/out segment tinting (I7), or stay as it is?
- **Hold chip in hidden mode** still shows that a hold exists ("$•••.•• held for 1 booking"). It reveals no
  amount. Should it stay?
- The remaining v2 questions still apply: non-USD `lastSeenPrice` (hidden now), frozen-wallet redemption, the
  altitude scale window, and Turkish strings at port.
