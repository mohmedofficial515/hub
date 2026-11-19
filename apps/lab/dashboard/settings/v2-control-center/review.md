# Review — dashboard/settings/v2-control-center (2026-11-19)

Reviewer: ux-critic. Standalone headless Chromium (own instance), reduced motion, owner viewer. Screenshots in `review-shots/`.

## Coverage and honesty note
The lab dev server was extremely slow (10 s to 90 s per page, other reviewers in parallel). The full matrix
(3 widths x RTL/LTR x light/dark x every page) was NOT achievable. What was captured and measured:

| Captured (review-shots/) | Measured |
|---|---|
| overview: 1440-en-dark, 768-en-light, 390-ar-dark, 390-en-light | overflow, targets, font, stripes (script), no console errors |
| group pages 1440-ar-light: refund_policy, security, notifications, payment_gateways, whatsapp_provider, maintenance | visual read |
| refund_policy: 1440-en-dark, 768-ar-light, 390-ar-light (crops `c-*.png`) | overflow 0, targets |

NOT verified by me (no capture finished): review-before-save sheet (both risk types), history drawer and restore,
preferences page, search results and deep-link highlight, keyboard tab order and visible focus, computed WCAG contrast
(my first contrast pass was invalid because of oklch colour strings and was discarded; the author's README also says
contrast was only checked by eye), reduced-motion behaviour, layout shift, loading/empty/no-access states, dark mode of
group pages. For these I only read source and the README; scores that depend on them are marked (est.). A re-run of
`audit2.mjs`/`audit3.mjs` (scratchpad) once the server is idle would close the gap.

Verified clean: no horizontal overflow at 1440/768/390 (all captured pages, 0 px); Cairo is the computed font on all
pages; no coloured side/top card stripes found by the border scan; no console errors on captured pages.

## Scores (1–5)
| Pillar | Score | Verdict |
|---|---|---|
| Hierarchy | 4 | Board is clear: title, search, attention, latest changes, calm section cards. Rows on group pages carry too many chips. |
| Clarity / information architecture | 4 | One shell, attention triage, overlap panel instead of duplicated fields. Some copy repeated, ambiguous field labels. |
| Creativity | 4.5 | Computed live value summaries and a rule-based attention list are a genuine step beyond a directory. |
| Visual polish | 3.5 | Neutral, tidy cards in light and dark; blemishes: chip clutter, unbalanced masonry, gateway cards with big empty areas, clipped text inputs. |
| RTL | 3.5 | Logical classes mostly used, arrows rotate correctly; physical `right-3` on stepper unit, mixed digits in datetime. |
| Accessibility | 3 (est.) | Strong ring classes and 44px min on mobile in most places, but 53 sub-44px targets on mobile group page; contrast and keyboard unverified. |
| Responsiveness | 3.5 | No overflow, good stacking; mobile group header pushes first field below the fold. |
| Completeness | 4.5 | Nearly every must-have is present in code/README; review, history, restore, prefs unverified visually. |

## Findings (prioritised)
### P0
None confirmed. Items that could become P0 are unverified: sticky save bar overlapping the last field or the keyboard on
mobile, and contrast of tiny 12 px grey meta text in dark mode (see P1-8).

### P1
1. **Ambiguous field labels on security group.** `security-1440-ar-light.png`: the "Client sign-in methods" section has three
   toggles all titled «مفعل» (and one «العملاء» for a segmented control), staff section has «مفقلة»/«مفعل». The state word
   next to the switch repeats the title. A reviewer cannot tell which switch is which without the description. Likely
   source: label derived from the schema key tail (`.enabled`) in `parts/field-row.tsx` / `model.ts`/catalog labels.
   Fix: label = parent + key («تسجيل الدخول برمز الهاتف»), and do not echo the state in the title.
2. **Mobile group page: 53 interactive elements below 44 px** (`refund-390-ar-light.png`, measured): copy-link 28x28,
   Reset group 187x32, per-field Reset 125x32, tag pills (High impact, Financial control) 24 px high and focusable
   buttons, combobox 42. Files: `field-row.tsx:85,109,126`, `group-page.tsx:113`, `ui.tsx:218` (TipBadge `h-6`),
   `controls.tsx:308`, `search.tsx:227`. Fix: `min-h-11` below `sm`; make tag pills non-interactive text with a single
   info button.
3. **Copy-link is invisible to touch** (`field-row.tsx:85`): `opacity-0` until hover, so deep links are undiscoverable on
   phones and tablets. Show it always at `(hover:none)`.
4. **Text clipping in single-line text inputs** (`maint-1440-ar-light.png`, Message text ar/en): the message body
   «نحدّث نظام الدفع… تعد» and English «We are upgrading payments. Search and exi» are cut off. Long copy needs a
   textarea (`controls.tsx` type text, add `multiline` for long strings).
5. **Duplicated copy on WhatsApp page** (`whatsapp-1440-ar-light.png`): the section description and the field help repeat the
   same sentence («عند الإيقاف: تُلغى كل رسائل واتساب…», «تتصل بالـ Cartat عندما…») two to three times (switch row and webhook
   link row). Fix in `catalog` copy: section lead OR field help, not both; hide help when equal to the section lead.
6. **Three stacked notices on Maintenance** (`maint-1440-ar-light.png`): header description, «مجموعة جديدة» callout, «للعلم»
   callout all announce that the group is new and not yet in the control panel. Merge into one dismissible note
   (`group-page.tsx` callouts).
7. **Row chip clutter** (`refund-1440-ar-light.png`, `security-1440-ar-light.png`): one row shows up to five chips
   (High impact, Financial control, Two-person, Not default, Reset, plus Default and Range lines); on security every field
   carries an «أمان» chip, so the chip stops carrying information. Show the one highest-severity chip per row; move the
   rest into the info popover and the review sheet.
8. **Small low-emphasis meta text** (12 px grey on card in dark, 11–12 px "Default / Range / saved by"): likely below AA
   in dark mode; README admits contrast was only eyeballed. Measure with a tool before approval and raise the muted token
   or the size.

### P2
9. **Gateway cards leave large dead areas** (`gateways-1440-ar-light.png`): equal-height cards (Moyasar, Tap) have ~400 px of
   empty space beside tall neighbours (PayTR). Use independent masonry or `items-start`. Each secret repeats "env var",
   "Default: not set", "Reset to default"; a Reset on a secret is meaningless, drop it for secrets.
10. **Overview masonry unbalanced** (`overview-1440-en-dark.png`): left column ends ~600 px before the right one, leaving an empty
    block bottom-left. Balance by estimated height or use a CSS grid with row packing.
11. **Desktop primary actions at 36 px**: the attention «Fix» buttons are 45x36 / 49x36 (measured at 1440 and 768; fine on
    390). The scope switch is 36 px high and the demo-bar radios 32 px. Raise `Fix` to `min-h-11` since it is the main task
    button of the page (`overview.tsx` attention row).
12. **Mixed numerals** (`maint-1440-ar-light.png`): datetime inputs render Arabic-Indic digits (٢٠/١١/٢٠٢٦) while steppers show
    Latin digits (1440, 30). Pick one numeral system, or set `lang`/`numberingSystem` consistently.
13. **Physical direction**: `controls.tsx:153` unit suffix `right-3` (use `end-3` + `pe-*`); `group-page.tsx:73` picks the
    chevron by locale instead of `rtl:rotate-180`.
14. **Mobile group header height** (`c-refund-390-top.png`): breadcrumb, title, description, 3 meta lines, actions row, and a
    «ما الذي يُضبط أين» panel with three full-width pills push the first field about 700 px down. Collapse the panel and
    the meta into one line on phones.
15. **Prototype state bar** at the bottom of every page (`DemoBar`, `states.tsx`) reads as product UI and adds 100 px; hide
    outside the lab frame.
16. **Sticky save bar** appears mid-page in full-page captures (author knows). Not verifiable here: confirm in a viewport shot
    that it never covers the last field or the soft keyboard on 390.

## Must-have checklist (evidence level)
| Item | Status |
|---|---|
| Field-level search, path, deep link | Present in code/README (`search.tsx`, `f=` param); result UI not captured |
| Dirty state + sticky save | Present: «لا تغييرات · الإصدار 17…» card visible; dirty variant not captured |
| Readable review, no JSON | In code (`review-sheet.tsx`); not captured |
| Confirmations (type group name, second approver) | In code/README; not captured |
| History + forward-only restore | In code (`history-drawer.tsx`), History (4) button visible; drawer not captured |
| Reset to default (field/section/group) | Seen on screen at all three levels |
| Proposed-field marking | Seen: «مقترح · S-06 · P1» on security |
| Control per field type | Seen: switch, stepper with unit and humanised hint («= يوم واحد»), segmented, tag list, chips, ordered list, masked secret with show/replace, datetime, url, IP list |
| Overlaps explained without duplication | Seen: «ما الذي يُضبط أين» with links; but copy is duplicated inside pages (P1-5, P1-6) |
| Empty/loading/no-result/permission states | In code (`states.tsx`); not captured |
| Owner-only marking | Seen: «للمالك» on gateways and WhatsApp |

## Strengths
- Real status board: attention list with severity sort, one sentence each, a Fix button that goes to the exact field, plus the latest changes (`overview-1440-en-dark.png`). Far more useful than the baseline directory.
- Live value summaries per group («اختيار العميل · موافقة فوق 250 دولار · خلال 10 أيام») let you audit the platform without opening groups.
- Neutral cards, colour only on icon tiles and small pills; no stripes; Cairo in Arabic; no horizontal overflow; dark theme looks coherent.
- Group page structure: sticky subsection index, per-subsection Reset, Default and Range under each field, Advanced fold, "Not default" marker, proposed fields flagged.
- Special pages are well handled: gateway cards by provider with masked secrets and source, WhatsApp status and test message aside.
- Humanised hints («= 3 أيام», «= يوم واحد») on numeric durations.

## Compared with baseline
Clearly better for the main task of finding and fixing what needs attention (one board, one search, triage) and for safety
(drafts, review, history). It costs more reading per field row and per group page than the baseline: group pages are long
(refund_policy about 4600 px at 1440, 7000 px at 390) and rows are dense. Trimming chips and repeated copy would make it
clearly tidier as well as richer.

## Verdict
A creative, professional and substantially more useful control centre than the baseline: the attention board and live
summaries are the right idea and the safety model is thorough. It is not ready to approve yet: fix the ambiguous field labels on
security, the 44 px touch-target and hover-only copy-link failures on mobile, clipped message inputs and the repeated copy,
then re-capture and measure what this review could not (review sheet, history, search, preferences, keyboard focus, computed contrast,
sticky bar on mobile) because those were unverified here owing to server slowness. With those done it should score 4+ across the board.
