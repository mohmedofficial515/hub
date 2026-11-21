# Review — web/wallet/v4-twin-tanks   (2026-10-27)

Reviewer: independent UX critic (did not design this version). Evidence: lab frame
`http://localhost:6200/frame-web.html#/wallet/v4-twin-tanks?...`, Playwright Chromium (Node script, no MCP available),
390 / 768 / 1440 × ar / en × light / dark, amounts hidden (default) and shown, all 7 scenarios, reduced motion,
keyboard-only walk with a CDP accessibility-tree dump, source read against the Vercel Web Interface Guidelines.

| Pillar | Score /10 | One-line verdict |
|---|---|---|
| Hierarchy & focus | 7 | One hero number (`available`) and a clear held chip fix the baseline's double balance. At 1440 the top row carries three instruments side by side, and the primary CTA sits at the bottom inline-end corner. |
| Task flow & speed | 7 | Top-up is one click with a preset and a preselected method (the baseline needed typing first), and "Add $56.50" is excellent. Redeem drops keyboard focus to `<body>`. |
| Layout & responsiveness | 7 | No horizontal overflow in any of the 30 captures. Stacked layouts break the valve metaphor, and on mobile, points come after the whole top-up form. |
| RTL / bilingual | 8 | Mirroring, `<bdi>` isolates, localised ledger labels and Latin digits are all right. There are small copy slips ("محجوز لـ فندق", "الخادم"). |
| Accessibility | 5 | Targets are 44px and colour contrast is mostly good. But the valve slider has no name, the tank slider is nested inside `role="img"`, focus is lost after redeem, and tab order at xl does not follow the visual order. |
| Visual craft & originality | 8 | Distinctive and on-brand: the tanks, the boarding-pass tickets and the receipt slips read by shape. The vessel outline is too faint to carry the metaphor. |
| Motion & feedback | 7 | Reduced motion is honoured, and the live region announces the redeem result. Motion animates layout properties (`height`, `inset-inline-start`), and the drag clamps at the current scale. |

## Blocking issues (must fix before approval)

1. **The valve slider has no accessible name.**
   - **Where:** `parts/points.tsx:273-282`, all viewports and modes.
   - **Evidence:** in the CDP AX tree it shows as a `slider` with `name: ""`. `aria-label` is passed to the shared `@web/components/ui/slider` wrapper, which spreads it onto Radix `Root`. The focusable `Thumb` stays unlabeled (`web/src/components/ui/slider.tsx:24`).
   - **Why it matters:** a screen-reader user hears "slider, 1000" with no purpose (WCAG 4.1.2). The valve is one of the four owner goals ("link to rewards").
   - **Fix:** use Radix `Slider` directly here, as `cash-tank.tsx` already does, with `aria-label`/`aria-valuetext` on `Slider.Thumb` (for example "1,000 points, adds about $10.00"). Do not change the shared wrapper.

2. **The drag-to-fill slider sits inside a `role="img"` element.**
   - **Where:** `parts/cash-tank.tsx:346-350` (vessel `div role="img"`) contains `Slider.Root` at `:430`.
   - **Evidence:** the AX snapshot shows `img "Cash tank: $220.00 available, $30.00 held"` → child `slider "Top-up amount"`. ARIA gives `img` presentational children. Chrome still exposes the slider, but spec-following assistive tech can flatten it away, notably WebKit/VoiceOver on iOS, the main mobile platform in the Gulf market.
   - **Why it matters:** the signature control can disappear for assistive tech, and the image name is read around an interactive child.
   - **Fix:** split the vessel into a decorative layer (`role="img"` + label, containing only the liquid, band, ghost and lines) and a sibling `Slider.Root` absolutely positioned over it.

3. **Redeem loses keyboard focus.**
   - **Where:** `parts/points.tsx:315-326`. The button gets `disabled={busy}`.
   - **Evidence:** keyboard Enter on "Move to wallet" → `document.activeElement` is `BODY` while busy and after success, and the next Tab lands on "Hide amounts" at the top of the page (`review/after-redeem-1440-ltr.png`).
   - **Why it matters:** this breaks the keyboard main flow "redeem via valve" (WCAG 2.4.3). The user must tab back through about 13 stops.
   - **Fix:** use `aria-disabled` and ignore clicks while busy instead of `disabled`, or move focus to the result line (`tabIndex=-1`) after success. The same pattern applies to "Show more" (`tickets.tsx:119`) and the top-up submit (`top-up.tsx:662`).

4. **"Amounts hidden by default" is not fully honoured. This needs an owner decision before approval.**
   - **Where:** default state, `wallet.balance.shown` unset (`review/1440-ltr-dark-hidden.png`, `review/m390-rtl-light-hidden-fold.png`).
   - **Evidence:** with every balance masked, these still give the balance away:
     - **(a)** Trip cards show "Covered by your balance" for Jeddah $149.00 and Istanbul $184.00, and "Top up to cover" for Dubai $276.50. That puts `available` between $184 and $276.50 (`trips.tsx:475,522`).
     - **(b)** The tank shows ✓IST ✓JED and a fill level (`cash-tank.tsx:404-414, 466-483`).
     - **(c)** The points caption shows "Worth about $23.50" and the valve shows "Adds about $10.00" unmasked (`points.tsx:112-115, 308-312`). That is a money balance.
   - **Why it matters:** the owner made hiding a requirement (shoulder-surfing privacy). Today, anyone can read the balance range from a glance. The README lists this as an open question; it cannot be approved silently.
   - **Fix (recommended):** while hidden, replace covered/uncovered states with a neutral "Show amounts to see what your balance covers" and drop the check marks on tank labels. Treat "Worth about" and "Adds about" as balances (`<Money balance>`). Keep the liquid level only if the owner accepts it.

## Improvements

**High**
- **Hidden state:**
  - **The tank still reads as a capacity gauge in the default (hidden) state.** Mitigation 2 (visible ruler) and most of mitigation 4 disappear when amounts are hidden, because the scale ticks render `null` (`cash-tank.tsx:339`). What is left is a bare vessel about 60% full, with 3px rim lips (`:357-358`) that are hard to see at 390 px. The "No cap" line is 12px muted text (`panel-bits.tsx:436-439`).
  - **During a drag, the slider max is the room under the current scale** (`cash-tank.tsx:308-309`), so the customer physically hits a ceiling. The scale grows only after release.
  - **Verdict:** with amounts shown, the tank reads as a ruler about 70% of the time. Hidden, it reads as "half full of a fixed capacity."
  - **Fix:**
    - Keep the unlabelled tick marks plus a "+" or arrow above the rim when hidden.
    - Let the drag overflow the top (auto-extend the scale live once the thumb reaches about 90%).
    - Promote "No cap" next to the hero number at body size.
- **Keyboard End is not idempotent:** End → $250 (max 750), End again → $750 (max 2,250), a third End → $2,250, which is above the lab's daily limit (probe log). "End" should mean "maximum". Pin `aria-valuemax` to `maxUsd` (5,000) and use the scale only visually. Or make End jump to `room` without rescaling.
- **Tab order at xl does not follow the visual order** (`page.tsx:150-209`, grid areas).
  - **Evidence:** the visual layout is cash | valve | points over the top-up row. DOM and focus order are cash → top-up (bottom row) → Rewards (top-right) → valve (top-middle).
  - **Fix:** reorder the DOM to cash, valve, points, top-up, and move the top-up form visually with grid areas. Or accept the order and rely on the stacked order as canonical. Either way, the order must be consistent with reading order (WCAG 2.4.3).
- **The amount field's focus indicator is weak** (`top-up.tsx:556`, `input` has `outline-none` at `:576`). The only cue is the 2px border turning teal (#2db2b9 on white ≈ 2.4:1), and it is barely distinguishable in `review/focus-1440-ltr-amount-input.png`. Add the shared `focusRing` via `focus-within:ring-[3px]` on the wrapper.
- **"Book with your balance" shows on a $0 wallet** (empty scenario, `panel-bits.tsx:440-449`). It promises something false. Hide it when `available` is 0, or swap it for "Search flights".

**Medium**
- **Vessel outline contrast:** `border-primary/15` (light) and `border-white/15` (dark) are about 1.3:1. The outline is the shape that says "open vessel, not a box" (WCAG 1.4.11 asks 3:1 for meaningful graphics). Go to at least `/40` and make the rim lips 4–5px.
- **On stacked layouts, the valve arrow points the wrong way.** `ArrowUp` (`points.tsx:240`) at 390 points into the points tank directly above it, and at 768 into the top-up CTA, not toward cash. Use a directional label ("→ Cash balance") or a small cash-tank glyph instead of a bare arrow below xl.
- **Mobile order:** at 390 the points tank starts at about 1,050 px, after the whole top-up form, so "equal weight" holds only at xl. Consider a compact points summary row ("2,350 pts ≈ ••• · Convert") directly under the cash caption on mobile.
- **The 10–11 px text carries data:** scale ticks and trip markers (`cash-tank.tsx:336, 472`), the step tracker amounts, and "The final value…" (`points.tsx:313`). Use at least 12px.
- **The points input does not submit on Enter** (no `<form>`, `points.tsx:255`). Wrap the valve in a `<form onSubmit>`.
- **Server jargon in customer copy:** "The final value is set by the server" / "القيمة النهائية يحددها الخادم". Use "The exact amount is confirmed when you convert."
- **Arabic:** "محجوز لـ فندق في إسطنبول" (`i18n.ts:14`) has a detached "لـ". Use "محجوز لحجز: …" or "محجوز لـ" joined without the space ("لفندق").
- **Return banner:** the `role="status" aria-live` wrapper's content exists at mount (`panel-bits.tsx:471`), so many screen readers will not announce the return result. Move focus to the banner on load, or render it after mount.

**Low (guideline sweep, Vercel Web Interface Guidelines)**
- `cash-tank.tsx:362-367, 380-387`, `points.tsx:50-55`: these animate `height`/`bottom`. Animate `transform: scaleY` for the liquid instead.
- `points.tsx:222-228`: the stream animates `insetInlineStart`; use `translateX`.
- `panel-bits.tsx:481`, `top-up.tsx:668`, `points.tsx:324`, `tickets.tsx:125`: `animate-spin` is not gated by `motion-safe:`.
- `top-up.tsx:563-577`: the amount input lacks `name`, and on error the submit does not focus the field (the error is announced via `role=alert`, which is acceptable).
- `points.tsx:255`: the points input lacks `name` and `autoComplete="off"`.
- `trips.tsx:473`: the mobile carousel has no scroll affordance besides the 78% card width. Add a "1/4" indicator or a peeking gradient.
- `tickets.tsx:51`: the filter state is not reflected in the URL (the guidelines ask for it; optional on a wallet).
- `trips.tsx:506`, `tickets.tsx:211`: IATA codes and booking refs should carry `translate="no"`.
- Shared `slider.tsx:13` sets `touch-none` on the whole valve root, so a vertical swipe starting on the valve track does not scroll the page on phones. That is another reason to use Radix directly here (blocking issue 1).

## What is better than baseline

Compared against `v1-baseline/owner-1920-rtl-light.png`:
- **One balance instead of three equal numbers.** The baseline shows 250.00 on the card, 250.00 in the "الرصيد" row and 0.00 reserved, with the same visual weight. v4 shows one 36–40px `available` figure, with the hold as a chip that explains what it is for ("Held $30.00 · for Istanbul hotel · 1 night"). The chip jumps to and focuses the ticket (verified: focus `story-pay_77`, scrolled into view).
- **Faster top-up.** The baseline's method dropdown is disabled until an amount is typed ("أدخل المبلغ أولًا"). Here a $50 preset and Card are preselected, so the path is a single "Continue to payment" press, or 2 presses to change the preset. "Available after top-up" shows the result before leaving.
- **No more "double charge".** The baseline lists "Wallet payment reservation −228.99" and "دفع حجز −228.99" as two red rows. v4 collapses them into one "Paid −$228.99" ticket with a held → paid step tracker and the line "Charged once". Released holds are struck through rather than shown as income.
- **Localised ledger.** The baseline shows English backend strings ("Refund to wallet", "Wallet top-up") in the Arabic UI. v4 labels everything in Arabic, with the backend text only as a secondary line in `en`.
- **Rewards are visible and actionable.** In the baseline, rewards are a single word link inside a grey footnote. v4 gives points their own tank, tier progress and an inline conversion.
- **Booking push.** The baseline has nothing connecting the balance to travel. v4 adds trip lines, a trips strip with exact-gap top-ups and "Book with your balance".
- **States.** Frozen, pending, done, failed, loading and empty states all exist and are distinct. The frozen state removes top-up and explains why, and the failed state keeps the amount and offers "Try again".

### Owner goals
- **Encourage top-ups: strong (8/10).** The ghost fill, presets, "Available after top-up", "Covered after top-up" on trip cards and the exact-gap "Add $56.50" button make top-up feel purposeful. The prefilled $50 ghost is an effective nudge; the owner should decide whether every customer gets it (README open question).
- **Trust & clarity: good with caveats (7/10).** Hold explanation, ticket stories, running "balance after", "so far" month totals and secure-payment copy all add trust. Caveats: the tank-as-limit reading in the hidden default, the "server" jargon, and the balance-range leak in hidden mode (blocking issue 4).
- **Link to rewards: strong at xl, weaker on mobile (7/10).** There is equal weight and an inline redeem with a live preview at 1440, but at 390 points appear below the full top-up form. The unnamed valve slider (blocking issue 1) is a gap for assistive tech.
- **Push toward booking: strong (8/10).** Searched trips with indicative prices, coverage states, per-trip search links, and the curated fallback in the empty state ("Popular from Cairo"). It is the clearest of the four goals.

## Screenshots
All in `review/` (full page unless noted; "hidden" means default masked amounts, "shown" means `wallet.balance.shown=1`):
- Matrix: `{390,768,1440}-{rtl,ltr}-{light,dark}-hidden.png` (12 files).
- Amounts shown: `390-rtl-light-shown.png`, `390-ltr-light-shown.png`, `1440-rtl-light-shown.png`, `1440-ltr-light-shown.png`, `1440-rtl-dark-shown.png`.
- Scenarios: `390-rtl-light-{empty,loading,frozen,topup-pending,topup-done,topup-failed}.png` and `1440-ltr-dark-{same}.png`.
- Reduced motion: `390-rtl-light-reduced.png` (levels render at final height, no console errors beyond Motion's own reduced-motion notice).
- Mobile above the fold @2x: `m390-rtl-light-hidden-fold.png`, `m390-ltr-dark-hidden-fold.png`. The CTA is below the fold at y=895/922 with an 844 px viewport.
- Keyboard and focus:
  - `focus-1440-ltr-tank-slider.png`: thumb ring is visible but thin.
  - `focus-1440-ltr-amount-input.png`: weak indicator.
  - `focus-1440-ltr-hold-ticket.png`: hold chip → ticket.
  - `kbd-1440-ltr-after-gap.png`: gap fill → input focused with 56.50.
  - `kbd-1440-ltr-valve-focus.png`, `kbd-1440-rtl-tank-focus.png`.
  - `after-redeem-1440-ltr.png`: success message, focus lost.

Measured: no horizontal overflow in any capture (`scrollWidth == clientWidth` at 390/768/1440). No console errors. All interactive targets are at least 44px except the sr-only radios (their labels are 44px) and the valve thumb (24×24, meets WCAG 2.5.8 minimum). Teal CTA: navy #061b42 on #2db2b9 ≈ 7:1.
