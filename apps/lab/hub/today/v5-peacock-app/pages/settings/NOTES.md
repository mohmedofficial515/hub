# Settings: notes for the version README

## Layout idea
One view with seven tabs across the top (09 §18), held in `?tab=`. Each tab has its own shape. **General** is a calm form, with the
group's purpose on the start side and its fields on the end side. **Sources** leads with what is wrong: a panel per unhealthy source
with "What happened" beside "What to do", then the healthy ones. A 24-hour run strip shows when a problem began. **Roles** is a
matrix, reduced on a phone to one role at a time. **Notifications** is channels above a kinds × channels grid. **Tokens** is a short
table and a reveal-once dialog. **System** is a health list plus figures. **Audit** is a ledger grouped by day.

The access split: owner and PM get seven tabs. Everyone else gets Notifications and Tokens, a line saying who manages the rest, and
a 403 naming the roles on any other `?tab=`.

## Landing on the problem, with no shell change
The sidebar links to Settings with no query. With no `tab`, a manager lands on Sources when `sourceProblems > 0`, otherwise General;
any other member lands on Notifications. The choice is latched, so fixing the last problem does not throw the member off the page.
`useMyCounts` now reads `kit/admin-store.ts`, so the red count falls when a source recovers and returns on Undo.

## Router details worth keeping
- **`tab` is shared with the card sheet.** `openCard` and `closeCard` clear it. The page latches its tab and writes it back when the
  sheet closes, so opening a card chip from Audit does not move the page.
- **`action` is the sheet's too.** Audit's action filter is therefore `?verb=`, which maps to the API's `action` prefix.
- A hand-typed `settings/GTV-231?tab=audit` makes the sheet read `audit` as its own tab and show no panel. `openCard` never produces
  this URL. The real build should validate the value in `CardSheet`.

## Deviations from 09 and reasons
1. **Run strip per hour, and `diagnosis`, are proposals.** 04 §3.7 gives `lastError` and the last 50 runs. A fix button needs a code and
   a remedy, and a 24-hour strip needs history that a five-minute source overflows in 50 runs. Both are mocked in `settings.ts`.
2. **No "best on a larger screen" banner** (08 §7). Every tab was built for 390 px, so the banner would be untrue.
3. **`[Test] [Edit] [View runs] [Disable]` sit in a `⋯` menu on healthy rows.** Only "Run now" stays out. Unhealthy rows show the
   actions that matter in the panel. The spec's row of five buttons does not fit beside the strip.
4. **Audit on tablet uses the ledger, not the six-column table.** The table starts at 1024 px.
5. **Audit has a detail row** (IP, client, record number), which 04 §3.21 returns and 09 does not show. It keeps the table narrow.
6. **The QR is an illustration**, labelled as not scannable, because the lab has no QR library.
7. **Reading paths use a text reference**, not `DocPicker`, which did not exist when this was built.
8. **Quiet hours sit under Digests in General**, as the catalogue key `notifications.quiet_hours` suggests.
9. **`capture.*` settings have no fields.** 09 §18.1 does not list them, yet the dashboard diagnosis says to lengthen the polling period
   "in the source's settings". The source dialog has no such field either. See the question below.

## Questions for the owner
1. **Specialty mapping for `ops` and `docs`:** 09 §4 says `pm|backend`, 04 §2 says `backend|frontend`, 07 says `backend+frontend`. The page
   seeds 09's, because Today's ready list relies on it. Which is right?
2. **Where does the polling period live?** A field on each source, or a workspace setting (`capture.github.interval_sec`, as 03 §4.2 has it)?
3. **Should a manager always land on Sources while a source is late?** A late source that fixes itself still takes the landing.
4. **Read access:** 04 §2 lets every role read settings, 09 §18 gives them a 403. The page follows 09.

## Checked (2026-11-04, private headless Chromium)
- 7 tabs × 390, 768, 1440 × ar, en × light, dark: no horizontal overflow, 0 AA failures on rendered text nodes (lowest 5.23:1). Disabled controls are excluded, as WCAG allows.
- Scenarios `frontend`, `empty`, `loading`, `error` at 4 modes. Sara: two tabs, Notifications landing, 403 on the other five.
- Interaction flows, 69 scripted checks with Members, all passing: landing on Sources, fix and Undo moving the sidebar count, run history by keyboard, wrong-token error, token value gone after saving, audit filters in the URL, CSV download, sheet over Audit keeping the tab, `cards.decide` row after deciding, token shown once, archive by typing the slug.
- Phone: no control under 44 px. Tab through every tab: every stop shows a ring or outline.
- Not run: a screen reader; the `?worker=stale` state was built and not scripted; the PM persona, which the lab has no scenario for.

## Review answered (2026-11-04)
- **Source states** read `kit.sourceStatus`, one word per state, shared with Today and Inbox: يعمل، متأخر، يفشل، موقوف.
- **In-between:** while a fix or a run is working, the status pill says Running instead of jumping from failing to fine.
- **Fixing a source** marks its Inbox notification read, and Undo restores both. Today's Sources panel now reads the same store. The Inbox item and Settings both say 21:05.
- **Copy (M15):** «المطلوب منك», column «الفترة», default «الأحد 08:00». Audit rows use kit role names.
- **Not changed:** Audit keeps its own filter bar. It has date inputs and a CSV export that `FilterBar` does not model, and the review's M6 table did not list it.
