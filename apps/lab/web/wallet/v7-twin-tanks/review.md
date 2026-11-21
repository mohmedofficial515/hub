# Review — web/wallet/v7-twin-tanks   (2026-10-27, round 2: fix round of v4-twin-tanks)

Reviewer: independent UX critic (did not design this version).

**How this was tested**
- Lab frame `http://localhost:6200/frame-web.html#/wallet/v7-twin-tanks?...`, driven by Playwright Chromium from a Node script (no MCP was available).
- Matrix: 390 / 768 / 1440 × ar / en × light / dark, each with amounts hidden (the default) and shown. All 7 scenarios. Reduced motion. Touch drag with CDP touch events. Keyboard walks. A CDP accessibility-tree dump. axe-core 4.x. Computed non-text contrast.
- Source was read against the Vercel Web Interface Guidelines and against `web/src/features/flights/history/history-href.ts` → `search/url-state.ts`.
- **Test environment note:** the lab's Vite server full-reloaded the page every 5–10 s during this review, because v6 is being built in parallel. Early probes lost focus and state for that reason, not because of v7. All results below come from runs with the HMR socket stubbed, so there were no reloads (verified with a page marker).

| Pillar | Score /10 | Delta vs v4 | One-line verdict |
|---|---|---|---|
| Hierarchy & focus | 8 | +1 | "No cap" now sits beside the hero number, and the mobile points row puts rewards one glance from cash. The mobile top-up CTA is still below the fold (y≈1061 at 390×844). |
| Task flow & speed | 8 | +1 | Focus survives redeem, Show more and top-up. Enter submits the valve, and gap-fill focuses the field with 56.50. The curated-card label promises a search it does not run. |
| Layout & responsiveness | 8 | +1 | DOM order = visual order at every width, and no horizontal overflow in 54 captures. At 768 the points side starts ~950 px down, and toggling amounts changes the tank block width (176→228 px). |
| RTL / bilingual | 9 | +1 | Copy slips are fixed ("مخصّص لحجز…", no "server"). The arrow and stream direction follow the locale, and `<bdi>` amounts render correctly. Only a stray space appears in the sr-only names ("ابحث مجددًا : جدة"). |
| Accessibility | 7 | +2 | Both sliders are named, the slider is outside the img, End is idempotent and focus is kept. Remaining: an axe AA text-contrast failure (4.34:1), a 2.1:1 valve thumb, and a 2.3:1 points vessel and ticks. |
| Visual craft & originality | 7 | −1 | The hidden mist and seal are lovely, and the vessel finally reads as an open vessel. The valve is now a card with a detached pipe stub, so the signature "points pour into cash" is weaker than in v4. |
| Motion & feedback | 8 | +1 | Everything moves on transforms, spinners are `motion-safe`, reduced motion places levels directly, and the scale grows live during drag. The growth is fast: $50 → $2,460 in 1.5 s and ~$4,900 in 2 s when held at the rim. |

Average 7.9 (v4: 7.0).

### Owner goals, delta vs v4
- **Encourage top-ups: 8 (=).** The ghost, presets, "Available after top-up" and exact-gap "Add $56.50" all remain.
  - While hidden, coverage nudges are gone by design, so the push depends on the customer showing amounts.
  - The live-growing scale removes the "ceiling" feeling.
- **Trust & clarity: 8 (+1).**
  - The tank reads as a ruler, not a cap: ticks, a ▲▲ growth chevron, "∞ No cap" and a 3.75:1 outline.
  - The hidden state is neutral and explained ("Amounts are hidden, so we don't show what your balance covers. Show amounts").
  - The "server" jargon is gone.
  - Remaining: the $0 leak (blocking issue 1), and the hold-chip vs ticket mismatch (Improvements).
- **Link to rewards: 8 (+1).**
  - The mobile chip "2,350 pts · Silver · Convert ›" focuses the valve input.
  - The valve is fully named for assistive tech.
  - The visual link between the two tanks is weaker (see the layout verdict).
- **Push toward booking: 8 (=).**
  - "Book it", "Search again" and "Book with your balance" are plain same-tab links in the real `/{locale}/flights?…` format.
  - The curated cards' "Search this trip: Istanbul" lands on an empty search.

## Round-1 findings: verification

| # | v4 finding | Status | Evidence |
|---|---|---|---|
| B1 | Valve slider unnamed | **Resolved** | AX: `slider "Points to convert"`. In the DOM, `aria-valuetext` is "1,000 points" when hidden and "1,000 points, adds about $10.00" when shown (`valve.tsx:201-207`). The same in ar ("عدد النقاط للتحويل", "1,000 نقطة"). |
| B2 | Tank slider inside `role=img` | **Resolved** | In the AX tree walk, `slider "Top-up amount"` has no img ancestor. The img has its own name: "Cash tank, amounts hidden" / "Cash tank: $220.00 available, $30.00 held". |
| B3 | Focus lost on redeem / Show more / submit | **Resolved** | Enter in the points field keeps focus on the input during and after the redeem. The live line reads "500 points moved into your wallet." (hidden) or "…became $5.00…" (shown). The button route keeps focus on "Converting…" then "Move to wallet". Show more → focus moves to `li` "Back in your balance… GT-10302", the story that received the earlier steps. Top-up submit keeps focus on "Taking you to the secure payment page…". |
| B4 | Hidden amounts leak the balance | **Partial** | Fill, held band, trip lines (0 dashed lines in the tank), IATA labels, coverage badges, coverage tint, "Worth about", "Adds about" (masked) and the aria texts are all clean in en and ar across 6 scenarios. **The $0 case still leaks** (blocking issue 1). |
| H | Tank reads as a capacity gauge when hidden | **Mostly resolved** | Unlabelled ticks, the growth chevron and "∞ No cap" at body size are in place. Two gaps remain. Ticks are 2.3:1 in light mode. The hidden ghost fills the bottom half and reads as a level (Improvements). |
| H | Drag clamps at the current scale | **Resolved** | Touch drag held at the rim (390, ar): hidden 30 → 490 → 980 → 2,460 → 4,895. Shown 5 → 2,210 → 4,645 → 5,000. |
| H | Keyboard End escalates | **Resolved** | End ×3 → 5000 / max 5000 each time. Home → 5, ↑ → 10, PageUp → 60, ↓ → 55. Hidden valuetext is "$5,000.00"; shown adds "available after top-up $5,220.00". |
| H | Tab order ≠ visual order at xl | **Resolved** | At 1440 the order is Hide → tank → hold → Book → amount → presets → method → Continue → Rewards → valve field/thumb/Min/Half/All → Move → trips → filters → tickets → Show more. At 390 ar the same order holds, with "حوّلها" after "Book". |
| H | Weak amount focus | **Resolved** | A 3px teal ring with offset on the wrapper (`review/focus-1440-ltr-amount-input.png`). |
| H | "Book with your balance" on a $0 wallet | **Resolved when shown, but it created a hidden-mode leak** | Absent in the empty scenario. See blocking issue 1. |
| M | Vessel outline 1.3:1 | **Resolved for cash, not for points** | Cash: 3.75:1 light, 5.26:1 dark; the 5px lip is 3.75:1. Points vessel `border-amber-600/70`: **2.26:1** light. |
| M | Valve arrow wrong way when stacked | **Resolved** | A wallet glyph shows below lg, with "Goes into your cash balance". From lg, ← points to the cash side in both directions. |
| M | Points after the whole form on mobile | **Resolved** | The points row sits under the cash caption at y≈583 (390). |
| M | 10–11px data text | **Resolved** | No `text-[10px]` or `text-[11px]` left. |
| M | Points input ignores Enter | **Resolved** | `<form onSubmit>`, verified. |
| M | Server jargon | **Resolved** | "The exact amount is confirmed when you convert." / "يتأكد المبلغ الدقيق عند التحويل." |
| M | "محجوز لـ فندق" | **Resolved** | "مخصّص لحجز فندق في إسطنبول · ليلة واحدة". |
| M | Return banner not announced | **Resolved (by construction)** | The `role=status` wrapper is in the DOM at mount and the text arrives at 250 ms. Not verified with a real screen reader. |
| L | Height / inset animation | **Resolved** | Liquid, held band, ghost, thumb and points liquid all use `translateY`; the stream uses `x`. |
| L | Ungated `animate-spin` | **Resolved** | Every spinner uses `motion-safe:`. |
| L | Input `name` / `autoComplete` | **Resolved** | `name="amount"`, `name="points"`, `autoComplete="off"`. |
| L | `translate="no"` | **Resolved** | IATA chips and markers. |
| L | `touch-none` on the whole valve | **Resolved** | Touch swipe scrolls the page from the vessel body and from the valve track (129 px each). It is blocked only on the 44px tank handle and the valve thumb, as intended. |
| L | Carousel position cue; filter in URL | **Not resolved** | Declared out of scope in the README. |

**Spending-limit reading**
- **Shown:** the ruler ($0 / $250 / $500), the chevron above the top tick and "∞ No cap" next to $220.00 make "ruler, not limit" legible within a second (`review/1440-ltr-light-shown.png`).
- **Hidden:** the vessel is mist with an eye-off seal, and a composed "+$50" slice fills the lower half. Without numbers, that slice reads as "the tank is half full" (`review/m390-rtl-light-hidden-fold.png`, `review/1440-rtl-light-hidden.png`). It does not leak, because it is constant for any balance, but it reintroduces a "level" reading in exactly the state that should have none.

## Owner decisions: verification
- **Neutral hidden state.**
  - Clean (en and ar; default, topup-pending, topup-done, topup-failed and frozen):
    - The tank text is only "+$50" / "+$100".
    - There are 0 trip lines and no markers.
    - The trips strip shows prices plus "Search again" only.
    - There is no "Covered / Top up to cover / Worth about" and no Arabic equivalents.
    - Valve "Adds about ••••••".
    - The valuetexts are "$50.00" and "1,000 points".
    - The img labels are "Cash tank, amounts hidden" and "Points tank: 2,350 points".
    - Every "Book with your balance" target is the same href whether hidden or shown (`/en/flights?trip=oneway&slices=CAI_JED_2026-11-28&cur=USD`), so the href does not depend on the balance.
  - **Leak: the $0 wallet** (blocking issue 1).
  - **Residual, owner call (not counted as a leak under the "movements stay visible" rule):**
    - The hold chip masks "Held ••••••", but the first ticket directly below shows "On hold $30.00", so `reserved` is readable anyway.
    - The month line "In +$250.00 · Paid −$228.99 so far" stays visible.
- **Pre-filled search, same tab.**
  - Every link is a plain `<a href>` with no `target`.
  - The format matches `serializeFlightSearch`:
    - key order trip, slices, adults, children, infants, infantAges, cabin, cur;
    - `ORIG_DEST_YYYY-MM-DD` slices;
    - defaults omitted as with `clearOnDefault`;
    - `cur` from `lastSeenPrice.currency ?? currency`, as in `criteriaOfEntry`;
    - the locale prefix, as with `localePrefix: 'always'`.
  - **Divergences from `historyHref`** (`trips.tsx:44-60`), all of which disappear if the port calls `historyHref(entry)` plus the locale instead of re-implementing it:
    - **(a) Inconsistent trip type and slice count.** Real `criteriaOfEntry` → `validCriteria` rejects an inconsistent trip type and slice count, and also past dates, and returns `null`, so there is no link. v7 instead drops `trip=` and links a one-way search. For the lab's round-trip mocks this means "Search again: Istanbul" (a round trip) opens a **one-way** CAI→IST search.
    - **(b) The `stops` filter is missing.** `historyHref` adds `stops` from `maxConnections`; v7 ignores it.
    - **(c) Only `departed` is filtered**, not `dateInPast`.

## Layout change: did it keep the signature?
**It weakened the signature.** The new layout is the right call for order and responsiveness, but it costs the concept its core image.

In v4 the valve sat *between* the tanks, and the pour was the picture. In v7:
- The two sides are separated by a dashed rule.
- The valve is a form card under the points tank. Its "pipe" is a 2px dashed bar inside the card (`valve.tsx:124-140`) that connects to nothing.
- On success, the yellow stream runs inside that bar and stops at the card edge.
- The cash tank only rises later, through the CountUp and the liquid spring.

On a phone, the pipe is hidden entirely.

**What it gains:**
- order = reading order;
- a mobile points row;
- a more compact panel at 1440 (height 2,145 vs v4's taller three-column layout).

**Cheap ways to restore the signature without breaking order:**
- At lg, extend the pipe across the gutter, under the dashed divider, to the cash vessel's base. It is decorative, so its absolute position does not change DOM order.
- Let the stream end in a ripple and a +$ ghost on the cash liquid.
- Below lg, the points row could get a small "→ cash" pour animation on redeem.

## Blocking issues (must fix before approval)

1. **Hidden mode still reveals a $0 balance.**
   - **Where:** `parts/panel-bits.tsx:58, 114-125` (`empty = available <= 0` hides "Book with your balance" regardless of `shown`). Seen in en and ar at 390 and 1440 (`review/390-rtl-light-empty-hidden.png` vs `review/390-rtl-light-hidden.png`).
   - **Evidence:** hidden default has `bookWith: ["/en/flights?trip=oneway…"]`; hidden empty has `bookWith: []`.
   - **Why it matters:** the owner decision says nothing may reveal the balance while hidden. A customer who spent down to $0 still has history, so the missing button is the only tell. The README raises this as an open question, but the decision already answers it.
   - **Fix:** while hidden, always render the button. Use the shown/hidden-independent target `bookWithHref(…, shown=false)`, which is already balance-independent. Optionally, use a neutral label in both hidden cases ("Find a trip" / "ابحث عن رحلة"). Keep hiding it on $0 only when amounts are shown.

2. **WCAG AA contrast failures on data text and on the valve thumb.**
   - **IATA chips:** in the trips cards (`trips.tsx:198-203`, `text-muted-foreground` on `bg-muted`), #737373 on #f5f5f5 = **4.34:1** at 12px. axe "serious", ×4–6 in light mode at 390 and 1440, including the empty scenario.
   - **Hold-chip second line:** (`panel-bits.tsx:95`) on the teal-tinted chip = **4.46:1**.
   - **Covered-card "Last seen" label:** (`trips.tsx:207`) on `bg-secondary/[0.06]` = **4.48:1**.
   - **Valve thumb:** (`valve.tsx:209`, `border-amber-500` on white over amber-50) = **2.13:1** in light mode, below the 3:1 non-text minimum (1.4.11) for the control's only visual identity.
   - **Why it matters:** these are measured AA failures. The IATA code is the card's key identifier, and the thumb is the valve's grab point.
   - **Fix:**
     - Use `text-foreground/75` (or `text-slate-600`) on chips and tinted cards.
     - Use `border-amber-600` (or a navy 2px inner ring) on the light-mode thumb.

## Improvements

**High**
- **The hidden ghost reads as a fill level** (`cash-tank.tsx:68-80, 225-242`).
  - **Problem:** with `base = 0`, a $50 composition fills about 50% of the vessel (scale `niceCeiling(50)`), and at the rim it fills it completely (`review/drag-390-rtl-hidden-at-top.png`). Glanced at, the hidden tank looks "half full".
  - **Fix options:**
    - Draw the hidden ghost as a floating dashed band near the rim (an "incoming" pour) instead of a slice from the bottom.
    - Or keep the hidden scale at a fixed large nice value (for example $1,000), so $50 is a thin slice.
- **Port: reuse `historyHref`, do not re-implement it** (`trips.tsx:44-60`). See divergences (a)–(c) above. In the lab, the round-trip cards open one-way searches. Also add `stops` from `maxConnections`.
- **Curated cards promise a destination they do not search** (`trips.tsx:97, 226-227`).
  - **Problem:** "Search this trip: Istanbul" → `/ar/flights` with nothing pre-filled.
  - **Fix:** relabel to "Search flights" / "ابحث عن رحلات", or pre-fill `slices=CAI_IST_<date+14>` with a home-airport assumption marked as "needs backend".
- **Drag growth is fast for touch** (`cash-tank.tsx:33-34`, 450 ms per nice step).
  - **Problem:** holding the thumb at the rim reaches $2,460 in 1.5 s and ~$4,900 in 2 s. A thumb that overshoots the rim on a phone silently composes thousands. It is recoverable, because the field shows the value and the daily limit errors, but it is jarring.
  - **Fix:** use 700–900 ms per step, require the pointer to stay ≥ 90% for one step before the first growth, and give a light haptic or visual pulse on each growth.

**Medium**
- **Points vessel outline is 2.26:1 in light mode** (`points.tsx:43`, `border-amber-600/70`). The cash vessel was fixed to 3.75:1, and the twin should match. Use `border-amber-600` or `amber-700/80`.
- **Scale ticks are 2.3:1 in light mode** (`cash-tank.tsx:172`, `bg-muted-foreground/60`). They are now the main "ruler" cue in the hidden state. Use `/90` or `bg-primary/50`.
- **The hold chip masks what the ticket below shows.**
  - **Problem:** "Held ••••••" sits next to "On hold $30.00" in the first ticket.
  - **Fix:** either mask the chip's amount only when the ticket is masked too, or accept and drop the mask there. The owner should decide; the current mix looks like a bug.
- **Toggling amounts shifts the tank block.**
  - **Problem:** the marker column goes `w-1` → `w-14` (`cash-tank.tsx:311`), so the block grows 176 → 228 px and the caption beside it jumps 52 px on toggle.
  - **Fix:** reserve the column width at all times.
- **Detached valve pipe** (see the layout verdict). Restore the pour across the gutter at lg.
- **At 768 the points side starts ~950 px below the cash side,** after the whole top-up form, and the valve is ~1,150 px down. The mobile chip mitigates this. Consider the two-column split from md, since the container-query form already fits.

**Low**
- **Sr-only names include a space before the colon:** "Book it : Jeddah", "ابحث مجددًا : جدة" (`trips.tsx:227, 243`). Drop the leading space in `": {trip.to}"`.
- **Duplicate names:** the valve field and the valve thumb share the accessible name "Points to convert". Name the thumb "Points to convert, slider", or label the field "Points (number)".
- **The tank slider reports a value of 5 when the amount field is empty** (`cash-tank.tsx:83`). Expose `aria-valuetext` "No amount yet" in that case.
- **Error focus:** on a range or daily-limit error, focus stays on "Continue to payment". The error is announced via `role=alert`; moving focus to the field would speed correction.
- **Ghost transition timing:** the ghost `height` changes instantly while the transform animates over 150 ms, so the slice edge jitters slightly while typing. Transition both, or use `scaleY`.
- **No `<h1>` in the lab** (axe `page-has-heading-one`). This is expected because the real hero holds the h1. Confirm at port time.
- **Still open from v4:** the carousel position cue and the filter state in the URL.

## What is better than baseline
Compared with `v1-baseline/owner-1920-rtl-light.png`, everything listed in the v4 review still holds:
- one hero balance instead of three equal numbers;
- an explained hold;
- one ticket per booking instead of a "double charge";
- a localised ledger;
- one-press top-up with a preset;
- visible rewards;
- a trips strip.

v7 adds the following over both the baseline and v4:
- **A neutral hidden mode that explains itself.** The baseline only masks numbers.
- **Booking links in the site's real search format,** same tab. The baseline has none.
- **Mobile rewards at a glance** under the balance. The baseline buries rewards in a grey footnote.
- **Keyboard and screen-reader parity** for both signature controls.

## Screenshots (`review/`)
- **Matrix:** `{390,768,1440}-{rtl,ltr}-{light,dark}-{hidden,shown}.png` (24).
- **Scenarios:**
  - `390-rtl-light-{empty,loading,frozen,topup-pending,topup-done,topup-failed}-hidden.png`
  - `1440-ltr-dark-{…}-shown.png`
- **Mobile fold:** `m390-rtl-light-hidden-fold.png`, `m390-ltr-dark-shown-fold.png`.
- **Reduced motion:** `390-rtl-light-reduced-shown.png`.
- **Panel crops:** `crop-1440-ltr-dark-hidden-panel.png`, `crop-1440-rtl-light-shown-panel.png`, `crop-390-rtl-light-pending-hidden.png`.
- **Keyboard and focus:**
  - `focus-1440-ltr-tank-slider-{hidden,shown}.png`
  - `kbd-1440-ltr-tank-end-{hidden,shown}.png`
  - `focus-1440-ltr-amount-input.png`
  - `kbd-390-ltr-after-redeem-{hidden,shown}.png`
- **Touch drag:** `drag-390-rtl-{hidden,shown}-{at-top,released}.png`.

**Measured:**
- No horizontal overflow (`scrollWidth == clientWidth`) in any capture.
- No console errors. The only warning is Motion's reduced-motion notice.
- All targets are ≥ 44px except the valve thumb (28px), which meets WCAG 2.5.8.
- Hidden-mode leak scan, AX dumps and axe results come from Node probe scripts in the reviewer's scratchpad. The scripts are not part of the version.
