# Review: Hub / Slice 6 (Backups, reaching Hub from other devices, Database page), 2026-11-08

Independent UX review of three areas as built: Settings › Backups (docs/16 D61, D62, "Slice 6 as built"), Settings › Devices › Reaching Hub from other devices (docs/16 §10, D43), and the Database page, Schema Studio (docs/17). I did not design or build any of them. Contract: `apps/web/README.md` (§ Settings › Backups, § Rules, § Tests).

**How it was checked.** Owner's real instance at `http://localhost:7300`, already signed in as the owner, in Playwright (Chromium). Viewports 1440×900, 834×1112 and 390×844, in `ar` (RTL) and `en` (LTR), light and dark, with the chat panel open (the owner's saved state) and closed. Contrast was computed from rendered colours (alpha and opacity blended). Focus order was walked with Tab. Targets, overflow and layout shift (`PerformanceObserver`) were measured in the page. The source files were then read against the Web Interface Guidelines and Hub's own rules.

- **Nothing was changed.** A guard in the test browser answered every non-GET API request with 403 (only `POST auth/refresh` passed). It caught one request: `POST /workspaces/goteav/today/seen`, fired by the Today page I passed through. No Back up now, Keep, Delete confirm, Save, Refresh, Suggest names, draft, annotation, Claim, Send or approval was pressed. The Delete and Propose-a-change dialogs were opened and closed with Escape. One settings field was typed into and reverted with Discard, with no request sent.
- **Sample data.** To judge states the instance does not have (running, failed, kept, deleted, missing backups, low disk; a schema with drafts, annotations and change marks), `GET …/backups` and `GET …/schema` were replaced **inside the test browser only**. The schema sample is Hub's own Prisma schema, parsed with the API's own `prisma-parse.ts`. Those screenshots start with `SAMPLE-`.
- **Real Goteav schema.** At my first look, `goteav` had no schema source. A few minutes later it had one (`F:/Goteav/backend/prisma/schema`, snapshot `e8e02b4d`: 119 tables, 1,950 columns, 108 enums, no parser warnings). Someone else set it: my tab's network log has no PUT or POST to `schema/*`. The Database findings are confirmed on that real data where marked.
- **Restored afterwards:** `hub-panel:open=true`, `hub-panel:width=440`, the `NEXT_LOCALE=ar` cookie (navigating to `/en/...` had set it to `en`), and no colour-scheme emulation. No `hub-theme` cookie was ever set. The locale switch was not used, because it sends `PATCH /me`.

| Pillar | Backups | Devices › reach | Database | One-line verdict |
| --- | --- | --- | --- | --- |
| Hierarchy & focus | 8 | 6 | 5 | Backups reads in a clear order. Devices shows four amber facts with no summary. The Database header takes 270 px, and four floating layers crowd the canvas. |
| Task flow & speed | 7 | 5 | 3 | Backups is quick and the restore command comes filled in. The Devices steps ignore what Hub already knows. On the Database page, "Read the design" is dead on reload and the dictionary hides most columns. |
| Layout & responsiveness | 7 | 8 | 4 | No horizontal overflow anywhere, and CLS is at most 0.016. The selected settings tab is off screen at every width. On the Database page the legend, minimap and dock cover the selected table. |
| RTL / bilingual | 6 | 6 | 4 | Isolates are used well in Settings. Backup failures show in English. "This machine" is ambiguous. Schema counts have no plural forms in either language, and two Latin tokens break bidi. |
| Accessibility | 7 | 8 | 3 | Settings has visible focus, a logical order and AA contrast, except faded deleted rows (3.78:1). On the Database page, the diagram cannot open a table by keyboard, header buttons lose their names on phones, and a failed save is silent. |
| Visual craft & consistency | 9 | 9 | 3 | Settings is Hub's kit: neutral cards, an icon and a word per state. The Database page breaks the owner's no-coloured-edge rule and Hub's no-gradient and shadow rules. |
| Motion & feedback | 7 | 6 | 5 | Spinners, toasts and the delete confirmation are sound. Failures give no next step, and nothing re-checks Tailscale. An annotation that fails to save reverts with no message. |

## Blocking issues (must fix before approval)

### B1. Database setup: "Read the design" is disabled on a direct load or reload, with no reason, while the folder field shows a folder
- **Where:** `apps/web/src/components/schema/source-setup.tsx:25-27` and `:102`. Seen at `/ar/goteav/schema`, 1440, `ar` light, before the source existed. That capture was later overwritten by a real-schema capture with the same name, so no setup screenshot remains. The evidence below is from the DOM and React props.
- **What:** `const [path, setPath] = useState(suggested)` takes `suggested` from `workspace.data.repoPaths` on the first render. On a hard load the workspace query has not answered yet, so `path` stays `''` for good. The `<select>` then shows its first option (`F:/Goteav/backend`), while React's value is `''` (read from the element's props). The submit button is `disabled={!path || !schemaDir}`: disabled, at 60 % opacity (3.13:1), with no hint why. Reaching the page from the sidebar, with the workspace already cached, makes it work (`path` = `F:/Goteav/backend`, button enabled). The only way out on reload is to pick another folder and then the first one again.
- **Why it matters:** this is the page's first-run state. Every new project and every second schema source starts here. A reload, a bookmark or a link from a chat lands on the broken path.
- **Fix:** derive the value instead of freezing it, for example `const value = path || suggested`, or reset the state once `folders` arrive (`useEffect(() => { if (!path && suggested) setPath(suggested) }, [suggested])`). Show why the button is off if it ever is. Add a test that renders the form before the workspace answers.

### B2. The Database page cannot be worked by keyboard: the diagram does not open a table, and the inspector is about 170 Tab stops away
- **Where:** `diagram.tsx:309-312` (only `onNodeClick` selects), `diagram.tsx:341-348` (`Toolbar` and `Legend` rendered after `<ReactFlow>`), `schema-page.tsx:270-280` and `schema.css:1052-1076` (rail drawer), and the search dialog's Enter in `search-dialog.tsx:84`. Screenshot: `SAMPLE-schema-keyboard-node-focus-ar.png`.
- **What (measured):**
  - Enter or Space on a focused table node gives it React Flow's `selected` class, but the inspector does not open, because only a mouse click calls `studio.select`.
  - Tab order from the view switch on sample data: 42 rail stops (3 per domain), then 48 table nodes in data order (not visual order), then the toolbar at stop 90, then the dock at stop 97. Visually the toolbar sits on top of the canvas. On the real Goteav schema that is about 66 rail stops and 119 nodes.
  - At fit zoom (0.13 on Goteav) a focused node's ring is a few pixels wide, and the canvas does not pan to it.
  - Search → Enter opens the inspector, but focus goes back to the header's Search button, not into the inspector. So the inspector is still behind every rail stop, node and toolbar button.
  - The rail drawer (shown below a 68rem container, which includes 1440 with the panel open) has no dialog semantics. Opening it leaves focus on the toggle, and Escape does not close it.
- **Why it matters:** README § Tests requires that "Tab reaches everything in visual order". Naming tables in Arabic is the page's main job, and today it needs a mouse.
- **Fix:** handle `onSelectionChange` (or `onNodeKeyDown` for Enter) the same as a click. Render the toolbar before the canvas, or give the canvas one Tab stop with arrow-key roving between nodes. Move focus to the inspector's heading when it opens from search, the dictionary or a node, and back on close. Give the drawer `role="dialog"`, focus on open, Escape and return focus, or reuse the kit's sheet. Pan to the focused node (`onNodeFocus` → `setCenter`).

### B3. The Database page breaks the owner's no-coloured-edge rule and Hub's surface rules
- **Where:** `apps/web/src/components/schema/schema.css`. Seen in every Database screenshot.
- **What:**
  - `:531-536` `.schema-row[data-recent] { box-shadow: inset 3px 0 0 var(--info) }` is a coloured side edge. README § Rules lists it word for word as forbidden: "No coloured edge in any form: border, pseudo-element, inset shadow, positioned bar".
  - `:410-415` and `:473-483`: every table card has a domain-tinted border and a domain-tinted gradient band across its top (`.schema-node-head`).
  - `:915-933`: enum cards have a domain-tinted border and a tinted top gradient.
  - `:712-716`: the inspector head has a tinted top gradient.
  - `:794-800`: the draft dock in review gets a cyan border and ring.
  - `:973-975`: the newest history item has a cyan border.
  - `:519-530`: rows are tinted for added, changed and removed ("Never tint a row").
  - Gradients at `:28-41` (header), `:52` (icon tile, with a cyan glow), `:114` (meter) and `:947` (timeline). The README bans gradients, and the ESLint rule only catches them in `className`, not in this CSS file.
  - Shadows deeper than `shadow-md`: node `0 10px 24px`, hover `0 16px 32px`, active `0 18px 36px`, dock `0 24px 60px`, toolbar `0 10px 30px`.
- **Why it matters:** the owner has rejected coloured side and top edges on cards in any design (D31, D56). He has also said consistency with Hub's pages matters more than novelty. This page now looks like a different product next to Tasks, Queue and Settings.
- **Fix:** make cards neutral (`bg-card`, `border-border`). Carry the domain in the existing coloured dot and the zone tint only. Show "changed recently" as an icon or badge in the row, not an edge or a tint. Use a plain `bg-card` header with `PageHeader`. Cap shadows at `shadow-md`. Mark the dock "in review" with a status pill, not a coloured border.

## Major

### M1. Settings: the owner sees "You don't have access here" on every direct load of a manager tab, including the inbox link for a failed backup
- **Where:** `components/settings/settings-page.tsx:115-116`. Screenshot `backups-forbidden-flash-ar-1440.png`, captured with `GET auth/me` delayed by 1.5 s so the flash would show; without the delay, DOM polling saw it at 340 ms and gone by 566 ms.
- **What:** while the session loads, `isManager` is false, so `visible = PERSONAL` and `allowed` is false. The tab renders `ErrorState` «لا تملك صلاحية الوصول هنا — هذا القسم يحتاج دور المالك أو مدير المشروع» with four tabs, then switches to ten. The layout-shift trace has a 0.0049 shift on an element with the empty state's classes (`flex flex-col items-center px-6 py-12 text-center`).
- **Why it matters:** a nightly failure writes a `backup_failed` inbox item that links here (docs/16 "How the backup works"). The owner meets a false "no access" exactly when something has gone wrong.
- **Fix:** while `loading`, render the tab skeleton, not the forbidden state (`if (loading) return <LoadingRegion …/>` before computing `allowed`).

### M2. Settings: the selected tab is off screen or clipped on arrival at every width, and the strip shows no sign that it scrolls
- **Where:** `settings-page.tsx:119-121` (effect with deps `[tab]` only) and `:163` (`overflow-x-auto … [scrollbar-width:none]`). Screenshots `backups-ar-light-1440.png`, `backups-en-light-1440.png`, `backups-ar-light-834-panel-closed.png`, `backups-ar-light-390-panel-closed.png`.
- **What (measured):** at 1440 with the panel open the strip is 629 px for 770 px of tabs. In `ar` the Backups tab is clipped to «النسخ الاحتيا» and Audit is fully hidden. In `en` the Backups label is entirely out of view, leaving only its underline stub. At 834 and 390 (panel closed) the Backups tab is completely out of view and `scrollLeft` is 0. The effect runs once while the session is still loading (M1), when the Backups trigger is not rendered yet, and never again.
- **Why it matters:** Slice 6 made this the tenth tab. The owner cannot see where he is, and on phones he cannot tell that Backups and Audit exist.
- **Fix:** add `visible.length` (or `allowed`) to the effect's deps. Add an edge fade or scroll buttons. Or group the tabs (Workspace, Me, Machine) so ten do not have to fit in one row.

### M3. Backups: a failure shows the raw English error in monospace in the Arabic page, with no next step
- **Where:** `settings/parts/backups.tsx:137-141`. The API stores `error.message` (`apps/api/src/modules/backups/application/backups.service.ts:354`), for example `No running Postgres container publishes the database port. Is Docker running?` or `pg_dump failed: …` (`backup-machine.ts:105-141`). Screenshot `SAMPLE-backups-states-ar-light-1440.png`.
- **What:** in `ar` the reason is an English sentence, four lines of red monospace with no Arabic summary. The row offers only Delete, and nothing says what to do (start Docker Desktop, free space, then Back up now).
- **Why it matters:** this is the one moment the history has to be read, and the inbox item points at it.
- **Fix:** store a failure code next to the text (`docker_down`, `pg_dump_failed`, `disk_full`, `folder_invalid`, `cut_off`). Render a localized sentence with a next step from it, and keep the raw text in a "Details" disclosure.

### M4. Backups: the Arabic words collide. «انسخ» is both "back up" and "copy", and «محفوظة» is both "pinned" and "kept by the rule"
- **Where:** `messages/ar/settings.json:759` (`now: "انسخ الآن"`) next to `:726` (`copyCommand: "انسخ الأمر"`), on the same page. `:788` (`kept: "محفوظة"`), `:809` (`keepCount: "عدد النسخ المحفوظة"`) and `:810` («والنسخ المحفوظة لا تُحسب»).
- **What:** the page's primary button reads like a clipboard action. The retention field is labelled "number of kept backups", and the help right under it says "kept backups are not counted". In Arabic that is a contradiction, not nuance.
- **Why it matters:** the owner sets retention once and must trust it. Natural Arabic copy is an owner rule.
- **Fix:** button «خذ نسخة احتياطية الآن». Pin «ثبّتها» / state «مثبّتة» / toast «ستبقى دائمًا». Retention «عدد أحدث النسخ التي تبقى», with help «النسخ المثبّتة لا تُحسب وتبقى دائمًا».

### M5. Backups: deleted rows are faded with `opacity-75`, so their text fails AA in light mode
- **Where:** `backups.tsx:110` (`backup.deletedAt && 'opacity-75'`). Screenshot `SAMPLE-backups-states-ar-light-1440.png`.
- **What:** meta text measured 3.78:1 and the «محذوفة» pill 3.45:1 on the card (light). Dark passes. README § Rules: "No `opacity-*` on text".
- **Fix:** drop the opacity. The «محذوفة» pill and the missing buttons already say the row is closed.

### M6. Devices: «هذا الجهاز» describes the main machine, but reads as the device in your hand, which is the reader this section is for
- **Where:** `settings/parts/publishing.tsx:57-58` and `messages/ar/settings.json:735` (`notInstalled`), plus `steps[0]` at `:746` («ثبّت Tailscale على هذا الجهاز»). Screenshot `devices-publishing-ar-light-390.png`.
- **What:** the facts come from `tailscale status` on the API's machine (`GET me/devices/publishing`). Once Tailscale works, the owner opens this page on a laptop or phone (step 4), and «Tailscale غير مثبّت على هذا الجهاز» / «يستمع Hub على كل واجهات الشبكة في هذا الجهاز» then describe a different machine from the one he holds.
- **Fix:** name it: «على الجهاز الرئيسي (الذي يعمل عليه Hub)», or the device's name from the Devices list. Split the steps under two headings, «على الجهاز الرئيسي، مرة واحدة» and «على كل جهاز آخر», as `docs/13-operations.md` §14 already does.

### M7. Devices: the steps don't follow the state Hub already knows, and leave out what the owner needs
- **Where:** `publishing.tsx:78-94`. Screenshots `devices-publishing-en-light-1440.png` and `devices-ar-dark-1440.png`.
- **What:**
  - Four amber facts with no summary line. Step 1 is not marked as the next step, even though Hub knows Tailscale is missing.
  - No link to `tailscale.com/download`, which §14 has.
  - The HTTPS-certificates step (§14 step 2) is missing.
  - "Restart Hub" has no command (`pnpm stop:local` / `start:local` or `hub:service`).
  - «وصل جهاز جديد» and `docs/13-operations.md` are plain text, not links. The doc reference is an English heading wrapped in Arabic quotes, which wraps badly at 390.
  - No "Check again". The API caches for 30 s, so after installing Tailscale the owner has to reload.
- **Fix:** a one-line status at the top («لم يُنشر بعد — الخطوة التالية: ثبّت Tailscale»). Steps as a checklist driven by the facts (done / next / later). The download link, the cert step and the restart commands in `CommandBlock`s. A «افحص الآن» button like the device health row above. Real links to the section and to the doc in Hub's Docs page.

### M8. Database: the canvas is crowded by floating layers that cover the selected table, and the legend's hide rule never applies
- **Where:** `schema.css:625-646`: the `@container studio (max-width: 80rem) { .schema-legend { display: none } }` rule comes **before** the base `.schema-legend { display: flex }` at the same specificity, so it never applies. `:636` `max-inline-size: calc(50% - 17rem)` then squeezes the legend to 66-67 px. Screenshots `schema-goteav-inspector-booking-ar-light-1440.png`, `schema-goteav-ar-light-1440-panel-open.png`, `SAMPLE-schema-node-zoom-ar-dark-1440.png`.
- **What (measured, real Goteav data):**
  - With the panel open at 1440 (the owner's default), the studio is 677 px wide and the header plus view bar take 270 px of 844, leaving a 677×621 canvas. The toolbar wraps to two rows (92 px).
  - The legend is a 67×314 column of one-word lines that sits on the diagram.
  - With the inspector open, Search → Booking centres the table, then the minimap (202×152) covers its columns and the idle dock covers its last rows.
  - `fitView` ignores the toolbar, so the top row of domains is hidden under it.
  - At fit zoom the small domains' names run into each other («storagereporting errorlogcountries»).
- **Fix:** move the legend source order (or put the rule after the base). Hide the minimap and legend whenever the inspector is open or the container is under about 70rem. Pass the toolbar's height as `fitView` padding. At far zoom, label domains in a list or a legend, not in overlapping canvas text. Consider moving the eight stat chips into one line or a popover.

### M9. Database: the `/` shortcut opens the global command palette, and the page's handler uses `e.key`
- **Where:** `schema-page.tsx:235-247` against `components/shell/shell.tsx:111` (`matchKey(e, '/')` → `actions.palette()`). Screenshot `SAMPLE-schema-search-empty-ar.png`.
- **What:**
  - Pressing `/` on the page (focus on the view switch) opened «لوحة الأوامر», not «ابحث في التصميم», although the header shows a `/` key hint.
  - The page compares `event.key === '/'`, which on an Arabic keyboard layout is «ظ». README § Rules: "Read through `matchKey(e, key)`, never `e.key`". It also skips `shortcutsEnabled()` and the dialog check.
  - The second shortcut needs Ctrl+Shift+K, while the file header says Ctrl+K.
- **Fix:** register the page's search with the shell's shortcut system (on this view, `/` opens the page search, or the palette offers "Search the design"). Use `matchKey`. Make the hint and the doc comment match the code.

### M10. Database: on phones the header's three action buttons have no accessible name
- **Where:** `schema-page.tsx:186-219`. Labels are in `hidden md:inline` / `hidden sm:inline` spans and the icons are `aria-hidden`.
- **What:** at 390 the accessibility tree reads `button`, `button`, `button` for Search, Suggest Arabic names and Refresh design. The `Tooltip` does not name them.
- **Fix:** use the kit's `IconButton label=…` below `sm`/`md`, or keep the text in an `sr-only` span instead of `hidden`.

### M11. Database: the dictionary shows only the first 600 columns while saying 1,950
- **Where:** `views.tsx:41` (`MAX_ROWS = 600`) and `:179`. Real Goteav data: the count reads «1,950 عمود», 600 rows render, and the last is `ReconciliationRun`.
- **What:** 1,350 columns cannot be reached unless the owner happens to filter. There is no "showing 600 of 1,950" and no "show more".
- **Fix:** virtualize the table (README guidance for large lists) or paginate. At minimum show «يظهر 600 من 1,950 — صفِّ بالنطاق أو ابحث».

### M12. Database: a failed Arabic-name save is silent and the typed text is lost
- **Where:** `inspector.tsx:172-176` (shows only `saving` / `saved`), `features/schema/queries.ts:107-109` (`onError` rolls the cache back), and `inspector.tsx:73-81` (the field resets from the cache when not focused). The same applies to `views.tsx:63` (the dictionary's inline name). Found by reading the code; not triggered live (see "Could not check").
- **What:** after a blur, a refusal (offline, 403, the API's secret filter) puts the old value back into the field with no message. None of the schema's free-text fields (description, notes, tags, the change dialog) use `detectSecret`, which README § Rules requires of every free-text form.
- **Fix:** show `annotate.isError` in the live region with a Retry. Keep the typed text in the field on error. Run `detectSecret` before saving.

### M13. Database: counts have no plural forms in either language
- **Where:** `messages/ar/schema.json:55` (`{n} جدول`), `:60` (`+{n} عمود`), `:135`, `:139` (`{n} قيمة`), `:168` (`{n} تعديل`), `:260`, `:272-274`, the stats labels, and the English twins.
- **What:** on real data «119 جدول», «2 جدول», «3 جدول», «3 قيمة», «+49 عمود». On sample data «3 تعديل», and in `en` "1 tables". Settings uses `plural(n, locale, forms)` with six Arabic forms, and README § i18n asks for it.
- **Fix:** turn each into a plural object (`zero one two few many other`) and render it with `plural()`. Example for tables: «جدول واحد / جدولان / # جداول / # جدولًا / # جدول».

### M14. Database: two Latin tokens break bidi in Arabic
- **Where:** `messages/ar/schema.json:248` (`setup.schemaDirHint`, «مجلد ملفات .prisma أو ملف .prisma واحد») and `schema-page.tsx:139-141` (`dir="ltr"` on the whole «الإصدار {hash}» span).
- **What (measured):** in the hint, the dot renders to the right of `prisma` ("prisma."; dot at x=1014, "a" at x=1007). In the header, «الإصدار» lands on the wrong side of `e8e02b4d`. The `·` separator before it is also missing, so it runs into «قُرئ قبل 3 دقائق».
- **Fix:** wrap tokens in isolates or `<Ltr mono>`, as Settings already does (`⁦.env⁩`): «مجلد ملفات ⁦.prisma⁩ …». Put `dir="ltr"` on the hash only, and add the `·`.

## Minor

**Backups**
- `backups.tsx:316-324`: the native time field shows «03:00 AM» (browser locale) right above «النسخة التالية غدًا 03:00» (24 h). Use a 24-hour control or set the input's `lang`.
- `backups.tsx:347-359`: the folder field's placeholder is the default path, in a dark placeholder colour (rgb 83 92 84). The empty field looks filled, and «الافتراضي: F:\HubBackups» repeats it under the field. Use a neutral placeholder («مثل D:\HubBackups»).
- `backups.tsx:103`: `usable` ignores `missing`, so Keep is offered for a backup whose folder is gone (`SAMPLE-backups-history-ar-dark-1440.png`). Exclude `missing`.
- `backups.tsx:370-392`: the sticky save bar covers the field being edited (the Keep count) at 1440×900 (`backups-savebar-ar-light-1440.png`). Add bottom padding equal to the bar, or `scroll-margin-bottom`.
- `backups.tsx:244-257`: the delete confirmation names only the time («أتحذف نسخة اليوم 23:05؟»). Add the size and folder name, since this cannot be undone.
- `messages/en/settings.json`: the row starts "today 23:05" in lower case. The trigger "Caught up" reads like a status; the Arabic «تعويض ليلة فائتة» is clearer ("Catch-up for a missed night").
- `backups.tsx:158`: `title=` for the Keep hint, not the kit's `Tooltip` / `Tip`.
- Every Radix dialog removes the page scrollbar and shifts the content about 15 px (shared, not Slice-6 specific).

**Devices**
- `publishing.tsx:48-50`: the address row uses `ok={secureCookies}`, so the URL itself gets an amber icon with no stated reason. It duplicates the next row. Mark the address neutral, or say "not https".
- `publishing.tsx:20-27`: the state is conveyed by an `aria-hidden` icon. The sentences carry it, except on the address row.

**Database**
- `search-dialog.tsx`: results lead with the code name (`Backup.status`) and put the Arabic name in small text below. In `ar` the Arabic name should lead when it exists. The footer «Enter يفتحه في المخطط» should use `Kbd`.
- `schema-page.tsx:122`: the H1 «استوديو قاعدة البيانات» differs from the sidebar, the breadcrumb and the page title («قاعدة البيانات»). The header is custom, not `PageHeader`.
- `schema-page.tsx:161`: the coverage chip hard-codes «٪», so `en` shows "4٪ named in Arabic".
- `schema-page.tsx:149-152`: «68+67 علاقة · ضمنية» does not say which number is which. Use «68 مُعلنة · 67 ضمنية».
- `schema-page.tsx:136-137`: «قُرئ» plus `<RelativeTime>` is built by concatenation (README: "never concatenation").
- Copy: «صفِّ النطاقات» reads oddly («ابحث في النطاقات»). «اترك المسودة» / «ترك هذه المسودة؟» differ from Hub's «تجاهل» for discard. «والـ migration» («وملف الترحيل»). «أُضيف جداول · 2» («جداول مضافة: 2»).
- `draft-dock.tsx` change dialog: for a table target the kind defaults to «تغيير عمود». The label «على» is terse («الهدف»).
- `views.tsx:192-198`: the dictionary column «الوصف» shows the files' `///` text, not the Arabic description. It is hidden by viewport `lg:` rather than the page-width variant README asks for beside the panel, so with the panel open the table scrolls sideways.
- `views.tsx` enums empty state says «لا قوائم تطابق.» when a schema has no enums at all.
- `schema.css:193-208`: «هذا فقط» and the per-domain «اقترح الأسماء العربية» appear only on hover or focus. They are hidden on touch, and their targets are 50×20 and 28×28 at 390 (README: 44 px on phones). «الكل» / «لا شيء» are 25×20 / 39×20. Rail rows are about 90 px tall, half of it the hidden actions.
- Domain colours repeat (identity and schema-studio share one; docs and queue share another), so the colour alone does not tell domains apart.
- At 390 the header path is clipped at its start («oteav/hub/apps/…»), and the closed rail's `box-shadow` bleeds a grey band along the screen edge (`SAMPLE-schema-ar-light-390.png`).
- Source setup: a novel hero (gradient tile) instead of the kit's `EmptyState`. The name field has `pattern` with no hint about allowed characters. The path hint uses `F:\Goteav\backend` while the select lists `F:/Goteav/backend`.
- Not UX, found while building the sample: `apps/api/src/modules/schema-studio/domain/prisma-parse.ts:23` (`BLOCK_START` requires `{` at the end of the line). A `model SessionLog {   // …` line is not read, so Hub's own schema loses `SessionLog` (117 unread lines). Goteav's schema has no such line today.

## What works well (compared with Hub's existing pages)

- **Backups is built from its neighbours.** One neutral card, a word and an icon per state (Done, Running, Failed, Folder missing, Deleted, Kept), the Queue tab's save bar, `ConfirmDialog` for Delete, and no restore button. The restore command comes filled in with the newest usable backup. It meets the owner's no-stripe rule.
- **The real state is honest:** «16.9 GB متاحة من 125.3 GB على قرص النسخ الاحتياطي», the next run «غدًا 03:00», the trigger «تعويض ليلة فائتة», «بلا مستندات», and the folder path in mono.
- **Measured basics in Settings:** 0 contrast failures on real data in both themes. Focus ring 2 px cyan with offset. Order: tab → Back up now → Keep → Delete → nightly → time → keep → folder → copy. The delete dialog starts on Close and Escape returns focus to Delete. Every phone target is 44 px or more (the checkbox's label is 44 px tall). No horizontal overflow at 390, 834 or 1440. CLS 0.016 (Backups) and 0.014 (Devices). Bidi isolates around `.env`, `/mcp` and `/bridge` render correctly (checked by character positions).
- **The Database page has strong ideas:** search is a proper combobox with `aria-activedescendant`. The inspector shows "saving / saved" in a live region. Ghost rows show draft proposals in place. History pairs versions with the closed drafts. CLS is 0.003, and framer-motion follows reduced motion through the shell's `MotionConfig`.

## What I could not check

- **Real Back up now, Keep, Delete, Save settings, and a real nightly or failed run**, plus the `backup_failed` inbox item: these would change state. The populated states are sample data.
- **Tailscale installed, connected and serving:** the instance has no Tailscale, so the "running / serves / matches" rows and the `.ts.net` address were judged from code only. A second real device was not available.
- **Live annotation saving, drafts, review in the panel, Suggest names and Refresh:** each writes data or sends a chat. M12 is from code. The in-review and applying dock states were not rendered.
- **The setup form's save path** (B1 after the fix), and the source dialog from the header.
- **A non-owner** (pm or backend) view of Backups and of the Database page (read-only inspector), because there is only the owner account.
- **Real touch devices and screen readers.** Touch was emulated by width only (no `pointer: coarse`), and names were checked in the accessibility tree.

## Screenshots

All in `docs/status/2026-11-08-slice6-review/`. Names starting with `SAMPLE-` use browser-side sample data (see "How it was checked").

- **Backups, real:** `backups-ar-light-1440.png`, `backups-ar-dark-1440.png`, `backups-en-light-1440.png`, `backups-{ar,en}-light-{834,390}.png` (panel open) and `…-panel-closed.png`, `backups-delete-confirm-ar-1440.png`, `backups-focus-keep-ar-1440.png`, `backups-savebar-ar-light-1440.png`, `backups-intro-bidi-ar.png`, `backups-forbidden-flash-ar-1440.png` (auth delayed 1.5 s to show M1).
- **Backups, sample:** `SAMPLE-backups-states-{ar,en}-light-1440.png`, `SAMPLE-backups-history-ar-dark-1440.png`.
- **Devices, real:** `devices-ar-dark-1440.png`, `devices-en-light-1440.png`, `devices-publishing-en-light-1440.png`, `devices-publishing-en-light-834.png`, `devices-publishing-ar-light-390.png`, `devices-publishing-ar-dark-zoom.png`.
- **Database, real Goteav schema:** `schema-goteav-ar-light-1440-panel-open.png`, `schema-goteav-ar-light-1440.png`, `schema-goteav-ar-dark-1440.png`, `schema-goteav-en-light-1440.png`, `schema-goteav-ar-light-834.png`, `schema-goteav-ar-dark-390.png`, `schema-goteav-search-ar-light-1440.png`, `schema-goteav-inspector-booking-ar-light-1440.png`, `schema-goteav-change-dialog-ar-light-1440.png`, `schema-goteav-enums-ar-light-1440.png`, `schema-goteav-history-ar-light-1440.png`. The setup-state capture was overwritten (see B1).
- **Database, sample (Hub's own schema with drafts and annotations):** `SAMPLE-schema-ar-light-1440.png` (panel open), `SAMPLE-schema-ar-light-1440-panel-closed.png`, `SAMPLE-schema-keyboard-node-focus-ar.png`, `SAMPLE-schema-search-*.png`, `SAMPLE-schema-inspector-{field,table}-ar-light-1440.png`, `SAMPLE-schema-node-zoom-ar-dark-1440.png`, `SAMPLE-schema-dock-open-ar-light-1440.png`, `SAMPLE-schema-dictionary*.png`, `SAMPLE-schema-enums-ar-light-1440.png`, `SAMPLE-schema-history-ar-light-1440.png`, `SAMPLE-schema-{ar,en}-light-{834,390}.png`, `SAMPLE-schema-rail-ar-light-390.png`, `SAMPLE-schema-inspector-ar-light-390.png`, `SAMPLE-schema-ar-dark-1440.png`, `SAMPLE-schema-en-light-1440.png`.

## Outcomes (2026-11-08, after the fixes)

Fixed on `feat/first-release` in commits `adba1c6` (reader), `9bc7e41` and `e0d0548` (failure kinds), `40852b0` (Check again), `99ee79d` (Backups and reaching Hub), `1690ea1` (Settings tabs), `f525ced` (B3 surfaces) and `d399ee8` (Database page). B3 waited for the owner, who chose on 2026-11-08 to apply the rule fully. Skipped items would change a layout beyond the fix itself, or are shared beyond Slice 6.

| Finding | Outcome | How, or why not |
| --- | --- | --- |
| B1 | Fixed | The folder is `picked ?? suggested`, so it follows the project's folders until the owner picks one; a direct load lands on `F:/Goteav/backend`. When the button waits, a line under it says why. The page also waits for the session before choosing the setup form or the read-only text. Render test with the project answering late (`schema-page.spec.tsx`). |
| B2 | Fixed | Enter or Space on a focused table opens the inspector (keydown on the canvas, by `data-id`); the toolbar and the focus pill come before the canvas in the DOM, so Tab reaches them before the tables; a search pick, the dictionary, an enum card or a table moves focus to the inspector's heading, and Escape or Close gives it back to the opener or the table; a table reached by Tab far out is brought to 0.85 zoom; the domains drawer is `role="dialog"` while open, takes focus, closes on Escape and returns focus to its toggle, and is `inert` while closed. Tables keep React Flow's data order: a single Tab stop with arrow roving was not built. Browser test `e2e/specs/schema-keyboard.spec.ts` (ar, en). |
| B3 | Fixed, owner's choice (2026-11-08) | Every card is one neutral surface with one neutral border: no domain-tinted borders or top bands on tables, enums or the inspector head, no inset edge or tint on rows, no cyan border on the dock or the newest history item, no gradient on the header, icon tile, meter or timeline, no glow on lit edges, and shadows at most `shadow-md`. A domain shows as its small coloured dot (rail, zone title, table head, inspector chip). "Changed recently" is a sparkle icon, a proposed change a badge in the table's head or an icon at the row's end, the dock in review a status pill. Sizes and spacing unchanged. |
| M1 | Fixed | The tabs render the skeleton until the session answers, so nobody is judged before the roles are known. Render test with `auth/me` held back, and a browser test with it delayed 1.5 s at 1440 and 390. |
| M2 | Fixed | The scroll-into-view runs again once the tabs exist (`ready`, `visible.length`). There was no Hub pattern for a scrolling strip, so the smallest cue was added: `useScrollCue` fades the edge that hides more (`.scroll-cue`, a mask, no colour, no layout change). The browser test checks the selected tab is inside the strip at 1440 and 390. |
| M3 | Fixed | `backupFailureKind` in contracts reads the API's own texts (Docker down, a refused container, `pg_dump`, a full drive, a refused folder, a restart cut-off) and the row shows `backups.failure.<kind>`, a sentence with the next step; the raw text is under Details with a copy button. A stored failure code was not added: it needs a migration, and the texts are Hub's own. Browser test with a file where the folder should be. |
| M4 | Fixed | «خذ نسخة احتياطية الآن» for the button, «ثبّتها» / «مثبّتة» / «ألغِ التثبيت» for pinning, «عدد أحدث النسخ التي تبقى» with «والنسخ المثبّتة لا تُحسب وتبقى دائمًا». English follows: Pin, Pinned, Unpin, "Newest backups to keep". |
| M5 | Fixed | `opacity-75` removed; the pill and the missing buttons say the line is closed. |
| M6 | Fixed | The facts name «الجهاز الرئيسي (الذي يعمل عليه Hub)», and the steps are split into «على الجهاز الرئيسي، مرة واحدة» and «على كل جهاز آخر». |
| M7 | Fixed | A summary line says where the owner is and the next step; each step is marked done, next or later from the facts (`publishingProgress`); the official download link, the HTTPS certificates step, `pnpm stop:local; pnpm start:local` and `pnpm hub:service stop; pnpm hub:service start` in `CommandBlock`s; «وصل جهاز جديد» is a real link to that section; Check again sends `Cache-Control: no-cache` and the API reads Tailscale again (at most once in 3 s). The doc stays plain text, now «docs/13-operations.md، القسم 14» with the path isolated: that file is in Hub's own repository, not in the project's Docs page, so there is nothing to link to. |
| M8 | Fixed | The legend's hide rule follows its base rule; the minimap and legend hide while a table is open, and the minimap under 70rem; centring puts the table in the part the toolbar and the dock leave clear; every fit passes their heights as padding; a far-out domain name is capped to its zone's width. The stat chips stay as they are (layout). |
| M9 | Fixed | The page's handler listens in the capture phase, reads `matchKey`, respects `shortcutsEnabled()`, skips inputs and dialogs, and stops `/` before the shell's palette. Ctrl+Shift+K, as the code always did; the comments now say so. Render test with an Arabic layout (`ظ` on the Slash key), browser test in both languages. |
| M10 | Fixed | The labels are `sr-only` below `sm`/`md` instead of `hidden`. |
| M11 | Fixed | Pages of 600 with «يظهر 600 من 1,950», a hint to filter, and «اعرض 600 أخرى». Not virtualised: an input per row loses focus when a virtual row scrolls away. |
| M12 | Fixed | A refused save keeps the typed text (the field no longer resets while the save is failed), says why in the live region with the API's words, and offers Retry; the dictionary and enum value fields keep their text and show a toast. Every schema free-text field and the change dialog run `detectSecret` first and never send a match. |
| M13 | Fixed | Plural objects (`zero one two few many other`) through `plural()` for tables, columns, enums, values, changes, unread lines, names not in the files, "+n columns" and the refresh summary; Arabic's dual stands alone («جدولان»). History chips read «جداول مضافة: 2». |
| M14 | Fixed | «مجلد ملفات .prisma أو ملف .prisma واحد» with each token isolated; the version is `fill` with the hash alone in `<Ltr mono>`, and the `·` separators are back. |
| Reader (`prisma-parse.ts:23`) | Fixed | `model SessionLog {   // …` and `}   // …` are read, and a type with brackets inside quotes, `Unsupported("vector(1024)")`, found while reading Hub's own schema. Unit tests, including Hub's whole schema with no warnings. |
| Backups minor 1 (time field) | Fixed | A 24-hour text field (`03:00`), padded on blur, refused with a message when it is not a time. |
| Backups minor 2 (placeholder) | Fixed | A neutral example, «مثل D:\HubBackups». |
| Backups minor 3 (Keep on a missing folder) | Fixed | A missing folder offers no pin. |
| Backups minor 4 (save bar) | Fixed | The field being typed in scrolls above the bar when it appears (`scroll-mb-28`). |
| Backups minor 5 (delete dialog) | Fixed | It names the size and the folder. |
| Backups minor 6 (English) | Fixed | "Today 23:05" starts with a capital; "Catch-up for a missed night". |
| Backups minor 7 (`title=`) | Fixed | The kit's `Tooltip`. |
| Backups minor 8 (dialog scrollbar shift) | Skipped | Shared by every Radix dialog in Hub, not Slice 6. |
| Devices minor 1 (address icon) | Fixed | The address is a neutral fact with a globe icon. |
| Devices minor 2 (state by icon only) | Fixed | Each fact says its state to screen readers. |
| Database minor 1 (search results) | Fixed | In Arabic the Arabic name leads; Enter is a `Kbd`. |
| Database minor 2 (H1, header) | Partly | «قاعدة البيانات», as in the sidebar. The custom header stays: `PageHeader` would change its layout. |
| Database minor 3 (coverage sign) | Fixed | `{pct}٪` in Arabic, `{pct}%` in English. |
| Database minor 4 (relations) | Fixed | «العلاقات: 68 مُعلنة · 67 ضمنية». |
| Database minor 5 (concatenation) | Fixed | `fill` for the read time and for "last edited by". |
| Database minor 6 (copy) | Fixed | «ابحث في النطاقات», «تجاهل المسودة» / «تجاهل هذه المسودة؟», «ملف الترحيل», «جداول مضافة: 2». |
| Database minor 7 (change dialog) | Fixed | A table's change defaults to adding a column; the label is «الهدف» / "Target". |
| Database minor 8 (dictionary description) | Fixed | The column shows the Arabic description, else the files' text marked `///`, and folds with `lg:@page-lg:` beside the panel. |
| Database minor 9 (enums empty) | Fixed | «لا قوائم ثابتة في هذا التصميم.» when there are none at all. |
| Database minor 10 (hover-only actions) | Partly | The actions show on touch, and the links and the per-domain button reach 44 px on phones. The rail rows keep their height (layout). |
| Database minor 11 (repeated colours) | Skipped | The palette has fewer colours than Goteav has domains; each dot sits beside its domain's name, so colour is never the only cue. |
| Database minor 12 (390 path, rail shadow) | Fixed | The path truncates at its end; the closed drawer casts no shadow. |
| Database minor 13 (setup) | Partly | The hero tile is neutral (B3), the name has a hint, and the path hint uses forward slashes. The hero stays rather than `EmptyState` (layout). |

**Tests.** Unit: `prisma-parse.spec.ts` (2 new), `publishing.service.spec.ts` (1 new), contracts `backups.spec.ts` (new), web `backups.spec.tsx` (5 new, 4 updated), `devices.spec.tsx` (1 new, 1 updated), `settings-page.spec.tsx` (1 new), `publishing-steps.spec.ts`, `scroll-cue.spec.ts` and `schema-page.spec.tsx` (new). Browser: `backups.spec.ts` (2 new tests, and the reach steps with Check again), `schema-keyboard.spec.ts` (new), in `ar` and `en`.

**For the owner.** Look at the Database page once on the real Goteav schema: its surfaces are now Hub's (B3), and what changed or is proposed shows as icons and small badges.
