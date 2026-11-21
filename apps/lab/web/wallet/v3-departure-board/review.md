# Review — web/wallet/v3-departure-board   (2026-10-27)

Reviewer: independent UX critic. Evidence came from the lab frame (`frame-web.html#/wallet/v3-departure-board`) using
Node Playwright (Chromium) and a read of every source file in the version. The matrix covered 390 / 768 / 1440 ×
ar / en × light / dark × amounts hidden / shown (24 captures), plus every scenario (default, empty, loading, frozen,
topup-pending, topup-done, topup-failed, error) at 1440 en light and 390 ar dark. The five main flows were run with
the keyboard only, with focus traced after each step. Contrast was computed from styles for every text node. The
audit also measured target sizes, checked reduced motion and recorded flip timing.

> Capture notes. (1) Playwright `fullPage` screenshots draw the 3D split-flap tiles wrongly: tiles look frozen
> mid-flip and "IST" shows as "IS". This is a capture artefact. A normal viewport render is correct, and computed
> `transform` is `none` once the flips settle, so all captures here use a tall viewport instead. (2) Other agents
> were editing the lab at the same time, which made Vite reload the page during some runs. Every finding below was
> reproduced in a run with no reload event.

| Pillar | Score /10 | One-line verdict |
|---|---|---|
| Hierarchy & focus | 8 | Shows one available number, and the dark board becomes the single focal surface. Pins and the "short by" state are too quiet. |
| Task flow & speed | 7 | "Add $57" fills the gate and focuses submit, which is excellent. The default hidden state and the gate's position on mobile slow the main task. |
| Layout & responsiveness | 6 | No overflow anywhere. The standby banner collapses to a 62 px text column on phones, and that is the default mobile view. |
| RTL / bilingual | 8 | Bidi isolates, Arabic as a single tile and `rtl:tracking-normal` are all correct. A few copy and screen-reader nits. |
| Accessibility | 6 | Real table semantics and a debounced live summary. Focus is lost after the reveal action, and the light-mode focus indicator measures about 2–2.6:1. |
| Visual craft & originality | 8 | A distinctive, coherent airport metaphor in both themes. Per-letter tiles for sentences ("G a t e  c l o s e d") look broken. |
| Motion & feedback | 8 | 180 ms flips settle in about 270 ms, and reduced motion is fully static. Feedback is clear on redeem, return and add-gap. |

## Blocking issues (must fix before approval)

**B1. The standby banner text collapses to one or two words per line on phones (the default mobile state).**
- Where: `parts/departure-board.tsx:168-184` (`flex flex-wrap` with the text `min-w-0 flex-1` beside a
  non-shrinking button). Affects 390 px in ar and en, light and dark, whenever amounts are hidden, which is the
  default per the owner decision.
- Evidence: the text column measures **62 px wide × 232 px tall in en** and **101 × 108 px in ar** at 390. "Board on
  / standby / Amounts / are / hidden. / Show / them…" stacks down the left while the button floats beside it. See
  `review/390-ltr-light-hidden-board.png`, `review/390-rtl-light-hidden-board.png` and `review/390-rtl-light-hidden.png`.
  At 768 it is fine (447 × 44).
- Why it matters: this is the first thing every mobile customer sees on the board, and it carries the only call to
  action that switches the page's core feature on. As shown, it reads as a layout bug.
- Fix: stack below `sm`. Use `flex-col items-stretch sm:flex-row sm:items-center` on the container and
  `w-full justify-center sm:w-auto` on the button, or give the text `basis-full sm:basis-0`.

**B2. Keyboard and screen-reader focus is lost after "Show balance & match trips".**
- Where: `parts/departure-board.tsx:167-185`. The standby block is rendered only while `standby`, so the focused
  button unmounts when it is activated.
- Evidence: the keyboard run (en and ar, 1440, Enter on the button) reports `document.activeElement` = `BODY`
  right after the reveal. The next Tab restarts from the top of the document.
- Why it matters: this is the action that turns the board on. A keyboard user is thrown to the top of the page,
  and a screen-reader user hears nothing about the change. The coverage sentence lands in the live region, but focus
  context is gone. This fails WCAG 2.4.3 (Focus Order).
- Fix: after `onReveal()`, move focus to a stable target. Options are the board heading (`tabIndex={-1}` on
  `#v3-board-title`), the footer summary `<p>` (make it focusable with `tabIndex={-1}`), or the first row's
  action. The cleanest is to focus the summary sentence, so the user hears "Your balance covers 2 of 4 trips"
  and continues from inside the board.

**B3. Focus indicators and the selected state miss 3:1 non-text contrast in light mode.**
- Where:
  - `parts/gate.tsx:454-455`: presets and submit use `ring-secondary/70`.
  - `parts/gate.tsx:555`: the amount field has only a `focus-within:border-secondary` 2 px border, and the input
    itself is `outline-none` (`:573`).
  - `parts/gate.tsx:632-633`: the radio card focus uses `ring-secondary/70`, and the selected state is
    `border-secondary`.
  - `parts/flight-log.tsx:25`: filters, story rows, "Show more" and "View booking" use the same ring.
  - `parts/trip-goal.tsx:481`.
- Evidence: `--secondary` is `#2db2b9`, which is **2.57:1 on the white card**, and it drops to about 2:1 at 70%
  alpha. In dark mode the same colour is 6.98:1, so this applies to light mode only. In
  `review/focus-1440-ltr-light-gate-preset.png` the ring around `$25` is faint. In
  `review/focus-1440-ltr-light-gate-radio.png` the focused-and-selected "Apple Pay" cannot be told apart from the
  merely selected "Card" style, because both use the same teal edge.
- Why it matters: this fails WCAG 1.4.11 (Non-text Contrast) on the gate, which is the page's primary conversion
  control.
- Fix: in light mode, use a navy ring at full opacity, for example
  `focus-visible:ring-primary dark:focus-visible:ring-secondary`. Navy on white is well above 3:1. Give the amount
  field a real focus ring, not just a border tint. Show the selected radio with a check icon or a navy 2 px border,
  so that selection and focus stay distinct.

## Improvements

**Task flow / owner goals**
1. **The gate is far down on phones.** At 390 ar light the gate starts at **y = 1120 px** (amounts hidden) or
   1023 px (shown), and "Continue to payment" ends at 1589 px. That is about 1.8 viewports of scroll before the
   owner's #1 goal can be acted on. At 768 it starts at 902 px. Below `lg`, add a compact "Top up" button to the
   status bar that scrolls to and focuses the gate, the way `fill()` already does. Another option is to render the
   gate before the board below `lg`; the board's "Add $X" buttons then still work.
2. **Hidden by default kills the board's value on first visit.** This is the README's own open question, and the
   evidence supports the authors' suggestion. Show the coverage words COVERED / NOT YET without amounts while
   hidden, and keep gaps and Add buttons for the shown state. Today a hidden-state row is just a price, five dots, an
   unlabelled arrow and a pin (`review/390-ltr-light-hidden-board.png`), which gives no pull toward top-up or booking.
3. **The "short" status has no word.** `parts/departure-board.tsx:314-315` renders only `+$57`, and screen
   readers hear only "+$56.50" (accessibility tree: `cell "+$56.50"`). Add a label: visible "NEED +$57" or
   "ينقصك $57", and srText "Needs $56.50 more".
4. **Board prices are rounded up.** `usdCeil` (`parts/departure-board.tsx:230,263`) turns a $276.50 last-seen
   price into "$277", while the screen-reader text says "$276.50". Rounding up a price harms trust (goal 2) and
   gives sighted and screen-reader users different numbers. Show cents, or round normally with "≈". Keep the ceiling
   only for gap or Add amounts.
5. **The trip goal is hard to discover.** It sits behind an unlabelled 16 px pin icon at `text-white/60`
   (`parts/departure-board.tsx:380-386`), and on mobile it sits beside an icon-only arrow. Add a visible "Goal" text
   label from `md` up. On mobile, consider making the row tappable to expand it into actions.
6. **Redeem failure is not handled.** `parts/redeem-panel.tsx:416-423` awaits `onRedeem` with no `try/catch`. A
   rejected `/loyalty/redeem` call (disabled, below minimum, network) leaves `busy` stuck on "Converting…" and
   shows no error. Add an inline error with a retry.
7. **The points value is masked while amounts are hidden**, even though the point count is shown
   (`parts/status-bar.tsx:312`, `parts/redeem-panel.tsx:490`). "2,350 pts ≈ $•••••" hides nothing about the balance,
   but it removes the most persuasive part of the rewards hook (goal 3). Show the ≈ $ value always.
8. **Submit loses focus while redirecting.** `parts/gate.tsx:654` sets `disabled`, and the keyboard run shows focus
   going to `BODY`. Use `aria-disabled` with a guarded handler, and announce "Taking you to the payment page…"
   through a `role="status"`.

**Accessibility / semantics**

9. Screen-reader text is uppercased in English: the destination is announced as "ISTANBUL"
   (`parts/departure-board.tsx:222`, where `srText` defaults to the uppercased text). Pass `srText={r.city}`.
   VoiceOver may spell out all-caps words.
10. The story row is one large button whose accessible name contains date, time, title, state, step count,
    reference, amount and balance (`parts/flight-log.tsx:263-313`; for example "27 Oct 15:40 Istanbul hotel · 1 night
    On hold 1 step GT-10421 $30.00 Balance after: $250.00"). Give it `aria-labelledby` covering title, state and
    amount, and put the rest in `aria-describedby`.
11. On mobile the log stacks two dollar values (the amount, then balance-after) with no visible label
    (`parts/flight-log.tsx:224-226, 305-307`). Prefix the second with "Bal." or "الرصيد".
12. Both redeem controls are named "Points": the slider via `aria-label` and the field via `<label>`
    (`parts/redeem-panel.tsx:451, 443`). Rename the slider to "Points slider", or hide it from assistive tech and
    keep the number field as the accessible control.
13. Muted text on muted surfaces misses AA slightly in light mode. "Balance after top-up" measures 4.35:1
    (`parts/gate.tsx:616`), the month header "In / Out / (so far)" 4.43:1 (`parts/flight-log.tsx:142`), and the
    "Released" chip 4.35:1 (`parts/flight-log.tsx:256`). Use `text-foreground/75` on `bg-muted`.
14. Target sizes at 390: the icon-only "Check price" link is 42 × 44 (`parts/departure-board.tsx:361-372`, compact)
    and the redeem "All" button is 40 × 44 (`parts/redeem-panel.tsx:473-479`). Add `min-w-11`.
15. Part of the amount field cannot be clicked: the 40 px-tall input sits in a padded wrapper whose padding does
    not focus it (`parts/gate.tsx:552-575`). Make the wrapper a `<label htmlFor>` or give it a `cursor-text` click
    handler.

**RTL / copy**

16. `boardEyebrow: 'المغادرون'` (`i18n.ts:41`) means "the people leaving". Use "المغادرة" or "رحلات المغادرة".
    `trDone: 'وصل'` (`i18n.ts:80`) is ambiguous without a subject; "تمّ" or "اكتمل الشحن" is clearer.
17. The board title "Trips your balance covers" / "رحلات يغطيها رصيدك" is shown while most rows are *not* covered,
    and in the frozen state. "What your balance can buy" / "ما يمكن لرصيدك شراؤه" stays true in every state.
18. The redeem slider is forced `dir="ltr"` (`parts/redeem-panel.tsx:458`), so in Arabic its minimum is on the
    left and ArrowLeft decreases the value. This is acceptable for a numeric scale, but it is inconsistent with
    the RTL page. Decide this deliberately.

**Visual craft**

19. "Gate closed" in English is split into ten letter tiles with gaps (`parts/gate.tsx:532`;
    `review/scn-frozen-1440-ltr-light.png`). It reads as "G a t e c l o s e d". Pass `whole`, as the status words
    already do, and uppercase it for board style.
20. The hidden balance renders as six large tiles ("$" plus five dots), which looks like a broken display. A single
    "$ ••••" tile, or three dot tiles, reads as intentionally masked.
21. Story titles truncate at 768 even though the row has room (`parts/flight-log.tsx:283`, "فندق في إسطنبول ·
    ليلـ…"). Allow two lines (`line-clamp-2`) below `lg`.

**Web Interface Guidelines (source sweep)**

22. Inputs lack `name` (`parts/gate.tsx:562`, `parts/redeem-panel.tsx:460`), and the points field also needs
    `autoComplete="off"`.
23. The placeholder "0.00" should show an example and end with "…", for example "100…", or be removed: the large
    grey "0.00" in a 48 px font reads as a value.
24. State is not reflected in the URL: the log filter and the opened story are lost on reload or share. Sync
    `?filter=` at least, because the hold chip deep-links into a story.
25. `touch-action: manipulation` is not set on the board or gate controls. This is minor because Tailwind
    `transition` lists its properties, so there is no `transition: all` issue.
26. Passed: `Intl.DateTimeFormat` for dates, the `…` character in loading copy, `tabular-nums` on number columns,
    `aria-live="polite"` for async summaries, `aria-hidden` on decorative icons and tiles, the reduced-motion
    variant, no `outline-none` without a replacement (only B3's contrast fails), `<button>` for actions and `<a>`
    for navigation, and no blocked paste or zoom.

## How well it serves the four owner goals

| Goal | Verdict | Evidence |
|---|---|---|
| G1 Encourage top-ups | **Strong on desktop, weak first impression on mobile** | Typing $100 flips the board and announces "With $100.00 more you cover 3 of 4 trips." "Add $57" fills the gate and focuses submit (verified). Balance-after shows $320.00, and the payment method is picked in advance. Undercut by the hidden default (standby) and by the gate sitting about 1.1k px down at 390 (Improvements 1–2). |
| G2 Trust & clarity | **Strong** | One number. The hold chip ("$30.00 held for 1 booking") opens and focuses the exact story, which shows a step timeline and "View booking GT-10421" (verified). Titles are localised, with the backend text only as an en sub-line. Ledger balance-after, month in/out with "so far", "last seen · not a quote", and the secure-payment line are all present. Weakened by rounded-up board prices (Improvement 4) and the per-device goal. |
| G3 Link to rewards | **Good** | The points chip with "Convert to balance" sits next to the balance. The inline slider and field convert in place: 2,250 pts became +$22.50, the balance flipped to $242.50, a confirmation took focus and the board re-evaluated (verified). With 0 points it links to rewards ("Earn points on every booking"). Weakened by the masked ≈ $ value (Improvement 7) and by having no error state. |
| G4 Push toward booking | **Moderate–good** | The board turns the customer's own searches into a "what you can buy" list. "Check price" and "Search a new flight" stay on screen, and the empty state switches to curated destinations ("Popular places to start"). The goal pin adds intent. However, the booking path is a secondary outlined link, and the goal feature is hidden behind an unlabelled pin. |

## What is better than baseline

Baseline: `../v1-baseline/owner-1920-rtl-light.png`.
- **Duplicate balance removed.** The baseline shows 250.00 $ twice (the card plus the "الرصيد" row) and a "محجوز 0.00 $"
  row with no explanation. v3 shows only `available`, with a labelled hold chip that navigates to the booking.
- **Ledger readability.** The baseline puts English backend strings in the Arabic UI ("Refund to wallet", "Wallet
  payment reservation", "Wallet top-up"). It also shows RESERVE −228.99 and payment −228.99 as two red debits,
  which reads as a double charge. v3 groups these into one "Cairo → Dubai · Refunded · 3 steps" story with a
  timeline and a ledger balance-after column, and adds filters.
- **Top-up speed.** The baseline's payment dropdown is disabled until an amount is typed ("أدخل المبلغ أولاً"), so
  the flow is amount, then method, then submit. In v3 the card is preselected, so a preset plus "Continue to
  payment" takes **2 actions**. From the board, "Add $57" then Enter is also 2 keystrokes, with focus already on
  submit. On desktop the gate sits in the first content row next to the board; in the baseline it is in the second
  row.
- **Rewards.** The baseline's only rewards entry is a link inside a grey footnote. v3 has inline conversion beside
  the balance.
- **Motivation.** The baseline has no link between balance and trips. v3's board and goal make the balance
  concrete.
- **States.** v3 adds frozen (amber notice, "Gate closed", "PAY BY CARD" on every row), top-up return rows
  (pending, landed, cancelled with "Try again" refilling $100), loading skeletons that reuse the flap dashes, log
  error with retry, and an empty log. None of these appear in the baseline.
- **Where the baseline is still better:** on a phone, its top-up form is reached sooner, because v3 puts the board
  and the goal card first. The baseline also never asks for a click before showing something useful.

## Screenshots

All captures are in `review/`. "hidden" and "shown" refer to the `wallet.balance.shown` setting.
- Matrix: `390|768|1440-{rtl|ltr}-{light|dark}-{hidden|shown}.png` (24 files)
- Standby squeeze (B1): `390-ltr-light-hidden-board.png`, `390-rtl-light-hidden-board.png`, with the 768 comparison
  in `768-rtl-light-hidden-board.png`
- Focus (B3): `focus-1440-ltr-light-gate-input.png`, `focus-1440-ltr-light-gate-preset.png`,
  `focus-1440-ltr-light-gate-radio.png`, `focus-1440-ltr-light-log-row.png`, with dark counterparts `focus-1440-ltr-dark-*`
- Flows: `flow-1440-en-amount100.png`, `flow-goal-en.png`, `flow-goal-ar.png`, `flow-1440-en-redeem-open.png`,
  `flow-1440-en-hold-story.png`, `390-{rtl|ltr}-light-redeem-open.png`
- Scenarios: `scn-{default|empty|loading|frozen|topup-pending|topup-done|topup-failed|error}-{1440-ltr-light|390-rtl-dark}.png`
- Arabic bidi crops: `zoom-1440-rtl-light-gate-100.png`, `zoom-1440-rtl-light-board-summary.png`,
  `zoom-1440-rtl-light-gate-error.png`

Measured facts:
- Horizontal overflow: none. `scrollWidth` equals the viewport in all 24 matrix combinations and all 16 scenario
  captures.
- Console: no errors or warnings.
- Contrast: dark mode has 0 failing text styles. Light mode has only the three near-misses in Improvement 13.
- Flip timing: the board settles in about 270 ms after an amount change (at most 4 tiles moving at once).
- Reduced motion: no tile transforms after a change, and the pulse dot has `animation: none`.
