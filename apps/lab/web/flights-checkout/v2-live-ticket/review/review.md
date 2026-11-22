# Review — web/flights-checkout/v2-live-ticket   (2026-11-21)

Independent ux-critic pass. Lab frame `http://127.0.0.1:7320/lab/frame-web.html#/flights-checkout/v2-live-ticket`,
own browser context, 24 full-page captures (390/768/1440 × ar/en × light/dark × passengers/payment) plus interaction
captures, all prefixed `critic-`. Owner rules are taken as given; the teal button's 2.57:1 white-text contrast is the
accepted owner exception (noted, not scored).

Overall: **7.3 / 10**. Verdict: **needs the blocking fixes below before owner approval.**

| Pillar | Score /10 | One-line verdict |
|---|---|---|
| Hierarchy & focus | 8 | The form is in the first viewport, and the ticket summary is a clear, single signature element. |
| Task flow & speed | 7 | Saved-traveller chips and the printed-name preview cut real effort; "Continue" with gaps does not show which fields are missing. |
| Layout & responsiveness | 8 | No horizontal overflow in any of the 24 captures. The bottom bar is sound. Two content-hiding issues (inner ticket scroll, mobile timer). |
| RTL / bilingual | 8 | Mirroring is correct, and Latin names are isolated with `bdi dir=ltr`. One Arabic number-agreement error, and the phone code is clipped. |
| Accessibility | 5 | Labels, the focus ring and contrast are good. The modal sheet does not trap focus, and missing-field errors are not exposed. |
| Visual craft & originality | 8 | The tear-line ticket is distinctive and on-brand, and surfaces are flat. Monospace type departs from the Cairo-only rule. |
| Motion & feedback | 7 | Reduced motion is respected and amounts roll. RTL load shows small layout shift (CLS 0.011–0.022, LTR 0). |

Measured: no horizontal overflow (scrollWidth = clientWidth at every size/mode); no console or page errors;
font sizes used 12/14/16/18/20/24/30 (no 13px); weights 400/600/700 only; every visible input/select has a label;
only contrast failure in light and dark is white on teal `#2db2b9` = 2.57:1 (owner-accepted); one teal primary per
screen. CLS after load: RTL 0.011–0.022, LTR 0.

## Blocking issues (must fix before approval)

1. **Price-details sheet is `aria-modal` but not modal** — `parts/mobile-bar.tsx:45-75` (`Sheet`), 390 and 768, any mode.
   Focus moves to Close on open (good), but Tab leaves the dialog after 2 stops and walks the page behind (country select,
   method radios, hold, Back, the Pay button). Screen-reader and keyboard users lose their place behind a scrim they
   cannot see past. Fix: trap Tab/Shift+Tab inside the dialog, and make the page behind `inert` (and lock body scroll) while
   the sheet is open. Return focus to the trigger on close, which already works.
2. **"Continue" with missing fields gives no field-level feedback** — `page.tsx:~160-170` (scroll handler),
   `parts/ui.tsx:120-150`, 1440 RTL light (`critic-1440-rtl-light-continue-missing.png`). After clicking Continue with 14
   empty fields, the page scrolls to passenger 2. However, 0 controls get `aria-invalid`, no empty field turns red, focus
   stays on the button, and the only cue is the grey "بقيت 7 حقول" in the card header. The user must work out which 7 fields
   are meant, and a screen reader announces nothing about where they are. Fix: on the first failed Continue, mark the empty
   required fields invalid with a short message ("مطلوب"), link help and error text with `aria-describedby`, add
   `aria-required`, and move focus to the first invalid control, not only scroll to it.
3. **The price-hold timer is invisible on phones during payment** — `parts/mobile-bar.tsx` (no timer), 390 and 768 with
   `step=payment` (`critic-390-rtl-light-payment-viewport.png`). On desktop the hold time shows in the ticket head and next to
   the total. On mobile it exists only inside the closed sheet, so a customer can lose the held price without warning on the
   device most of them pay from. Fix: show the clock and remaining time in the bottom bar next to the total (amber under
   2 min, as on desktop).

## Improvements

- **Major — fee transparency is hidden by the ticket's inner scroll on desktop.** `parts/ticket.tsx` body
  (`min-h-0 flex-1 overflow-y-auto`), 1440×900. scrollHeight 756 against clientHeight 569. The visible lines (fare,
  taxes, seats and bags) add up to SAR 2,507.25, yet the total says 2,586.00. The booking fee, the non-refundable service
  fee and "If you cancel" sit below an inner fold, marked only by a thin classic scrollbar. That works against the core
  goal ("fees from step 1"). Fix: compact the flight block (one line per leg) or collapse the names list after 3, so all
  price lines fit at 900px height. Failing that, add a visible "+ 2 more lines" cue.
- **Major (owner rule) — monospace face.** `font-mono` in `parts/ticket.tsx:134,142,186,215`,
  `parts/passenger-card.tsx:170,200,219,286,347`, `parts/saved-travellers.tsx:56,60`, `parts/passport-guide.tsx:37-49`,
  `page.tsx:264`. Names, IATA codes, the currency select and the name inputs use the system monospace, not Cairo. It is a
  deliberate boarding-pass device, but it breaks "Cairo font" and looks like Courier on Windows. Ask the owner, or use Cairo
  700 with `tracking-wide` and `tabular-nums`.
- **Minor — the phone country code is clipped.** Contact card phone select, 768 and 1440, ar and en: it renders "SA +96€".
  Widen the select or drop the "SA" prefix.
- **Minor — Arabic number agreement.** "أكمل 14 حقول للمتابعة" (`i18n.ts`, missing-count line). For 11–99 Arabic uses the
  singular accusative: "أكمل 14 حقلًا للمتابعة". Use `Intl.PluralRules('ar')` categories (`few` → حقول, `many` → حقلًا).
- **Minor — 36px currency select.** `parts/ticket.tsx:215` (`h-9`), 1440: 64–66×36. It is under the 44px target used
  everywhere else. It is acceptable on desktop, but the sheet reuses it on touch, so make it 44px there.
- **Minor — sheet radius.** `rounded-t-3xl` (24px) in `parts/mobile-bar.tsx`. The README says 22px, and the owner rule
  reserves 22px for photo cards. Use the 18px card radius.
- **Minor — tear-line notches.** At 1440 the half-circle notches on the ticket edges read as stray outline circles on the
  white page (`critic-1440-rtl-light-viewport.png`, left edge at y≈560). Fill them with the page background and drop
  their outline.
- **Minor — RTL-only layout shift.** CLS 0.011–0.022 in Arabic and 0 in English, probably the inline-end slide-in or a font
  swap measured as a shift. Check that the step enter animation uses `transform` only, and preload Cairo.
- **Minor — names use `autocomplete="off"`.** That is defensible for passport names, but the contact e-mail and phone are
  correct. Consider `autocomplete="family-name"`/`given-name` for passenger 1 only when signed out.
- Note: the native gender radios and the "save traveller" checkbox use the browser `auto 1px` focus outline, unlike the
  navy 2px ring elsewhere. Make sure the segment's visible ring is drawn on the label (`has-focus-visible`).

## What is better than baseline

- The baseline spends the whole first 1440×900 viewport on a 320px photo hero, a slogan and a sign-in gate. v2 puts the
  title, stepper, saved travellers and the first passenger's name fields in the first viewport, with the total and Continue
  always in view.
- The "printed on the ticket as" line (`ALHARBI/MOHAMMED SALEH MR`) in each card and in the ticket answers "is my name right?"
  as the customer types. The baseline does not do this at all.
- The saved-traveller chips fill a seat with one tap, and they disable a chip that fits no seat with the reason
  ("العمر لا يناسب أي مقعد") instead of failing silently.
- Payment says in one sentence what is charged, by which method and in which currency. Methods are ordered for Saudi
  Arabia with Apple Pay first, and each tile shows its own charge amount.
- Mobile: the fixed bottom bar always shows the total, price details and Pay. Content has 144px bottom padding, so
  nothing is hidden under the 73px bar.

## Screenshots

All in this folder (existing builder shots untouched):
- `critic-{390|768|1440}-{rtl|ltr}-{light|dark}-{passengers|payment}.png`: 24 full-page captures.
- `critic-1440-rtl-light-viewport.png`: first viewport, with the ticket's inner scroll hiding the fee lines.
- `critic-1440-rtl-light-continue-missing.png`: after Continue with 14 missing fields; no field marked.
- `critic-390-rtl-light-payment-viewport.png`: payment on a phone; no hold timer.
- `critic-390-rtl-light-payment-bottom.png`: page end above the bottom bar.
- `critic-390-rtl-light-payment-sheet.png`: price-details sheet (focus escapes it).

## Fixes after review (2026-11-21)

v2-live-ticket is frozen in `review`, so every fix went into **`v3-live-ticket`** (base v2, status `review`). Details and
measurements: `../../v3-live-ticket/README.md`, section "Fixes after review".

- Blocking 1 (sheet not modal): fixed. Focus trap, `inert` page and bar, scroll lock, focus back to the opener.
- Blocking 2 (no field feedback on Continue): fixed. Empty required fields get a red border, `aria-invalid`, `aria-required` and
  "مطلوب / Required" via `aria-describedby`; focus moves to the first one.
- Blocking 3 (no mobile timer): fixed. Timer row in the bottom bar on both steps, amber under 2 min.
- Major (fee lines behind the inner scroll at 1440×900): fixed. Compact ticket head, total pinned next to the button, all fee
  lines visible, "More below" cue for the cancel quote.
- Major (monospace): fixed. Cairo 700 + wide tracking everywhere.
- Minor: phone code (code only, not cut), Arabic plural ("14 حقلًا"), 44px currency select, sheet radius 18px, notch outlines
  removed, CLS 0 in Arabic, navy focus ring on gender and checkbox: all fixed. Name `autocomplete` left off on purpose.
- Checks: 24 captures + 13 state captures in `v3-live-ticket/review/`; `pnpm --filter @hub/lab typecheck` passes;
  `pnpm lab:check`: "Lab: 51 versions compile."
