# References — Hub "Today" (يومي)

Research date: 2026-11-03. Folder: `F:/Goteav/redesign/hub/today/research/`. Screenshots: `shots/ref-<product>-<view>-d.png` (1440 px) and `-m.png` (390 px); palette evidence boards: `shots/palette-*.png`; Arabic type specimen: `shots/type-arabic-specimen-d.png`.

Plan sources read: `F:/Goteav/project-hub/docs/09-pages.md` §4 (Today), `07-notifications-and-digests.md` §6.1 (morning brief), `08-ux-and-design.md` §1 and §3 (principles, tokens).

Honesty notes:
- Linear, GitHub, Stripe, Vercel, Notion, Plane, Duolingo, Sunsama and Basecamp app screens are behind login. I only captured public docs, marketing pages and their published product screenshots. Statements about logged-in UI that I did not see are marked **(unverified)**.
- Cookie banners were hidden in the DOM for screenshots, never accepted. On Sunsama and Plane the banner is still visible in the shot.
- Not captured: Vercel (the `/docs/dashboard-features` URL returns 404, and the dashboard needs login), Height (shut down on 24 Sep 2025, [alternativeto](https://alternativeto.net/news/2025/3/height-project-management-tool-to-shut-down-by-september-2025/)), Raycast, Arc, Spotify Wrapped (the newsroom URL returned 404), Akiflow (its marketing page showed no product UI). They are cited only where a source is given.
- Conflict with the current plan: `08-ux-and-design.md` P2 says "type colours are used only on the type dot, badge and the card sheet header stripe — never on whole rows or backgrounds. No gradients". Several bold ideas below (tinted awaiting cards, rings) bend P2. Each one is marked **[needs owner OK: P2]**.

## Job to be done
Every morning a Hub member opens Today and, in under a minute, wants to see:
- what waits on them and their roles: decisions, needs, handoffs, reviews;
- what they can pick up;
- what changed overnight: commits, PRs, AI sessions, contract handoffs;
- which deadlines are close.

They then act on the first item without leaving the page. The owner also checks that the team and the capture sources are healthy.

## ui-ux-pro-max results (design-system + ux + chart domains)
- `--design-system "project management productivity dashboard team activity daily planner"`:
  - Style: **Flat Design**, "no gradients/shadows, simple hover", 150–200 ms transitions.
  - Colours: teal primary `#0D9488` with orange accent `#EA580C`.
  - Font: Plus Jakarta Sans. Not usable here because it has no Arabic.
  - Checklist: 4.5:1 text contrast, visible focus, reduced-motion support, SVG icons instead of emoji.
  - The teal primary matches Hub's current primary `#0f6b5c`.
- Style domain:
  - "Bento Box Grid": modular cards of varied sizes (1×1, 2×1, 2×2), neutral base plus one brand accent.
  - "Data-Dense Dashboard": KPI cards row, 8 px gaps, 12–14 px type.
  - "Editorial Grid / Magazine": asymmetric grid, pull quotes. This one fits the agent narrative.
- Chart domain:
  - Heatmap: "Always include numeric color legend"; "Do not rely on color alone"; not for fewer than 20 cells.
  - Bullet chart: use it for 3 to 10 KPIs against targets.
  - Gauge or ring: only "when a defined target exists".
- UX domain:
  - "Don't convey information by color alone: use icons/text in addition."
  - "Minimum 4.5:1 ratio for normal text."
  - Empty states: "Show helpful message and action."

---

## 1. Layout references

| # | Product (URL) | Layout principle | "Needs me" vs "what happened" | How stats are shown | Fit for Hub Today |
|---|---|---|---|---|---|
| 1 | Linear Inbox ([docs](https://linear.app/docs/inbox)) | One list, two tabs: **Priority** (default) and **Other** | Tab split; the user decides what counts as priority and what the badge counts | Count chips on tabs ("Priority 4 · Other 12") | **High**: Awaiting me = Priority; Since last visit = Other |
| 2 | Linear My issues ([docs](https://linear.app/docs/my-issues)) | Fixed **focus order** of groups; a group shows only when it has items | Order itself encodes urgency | none | **High**: ordering rule for Awaiting me |
| 3 | Linear Pulse ([docs](https://linear.app/docs/pulse)) | Scheduled digest (daily or weekly, "around 6:00 AM in your local time") grouped Initiatives → Projects, with a **Listen** button | Digest is a separate "what happened" artefact pushed into Inbox | Bulleted facts inside each project | **High**: agent narrative format |
| 4 | GitHub dashboard + contribution calendar ([quickstart](https://docs.github.com/en/account-and-profile/get-started/personal-dashboard-quickstart), [profile](https://github.com/torvalds)) | Dashboard is "the first page you'll see"; calendar is a 53 × 7 grid with a Less→More legend | Dashboard: track your issues and PRs vs feeds of followed activity | 5-step single-hue ramp, "Learn how we count contributions" link | **High**: team activity heatmap |
| 5 | Stripe Dashboard Home ([docs](https://docs.stripe.com/dashboard/basics)) | Home "provides analytics and charts… It also surfaces important notifications, like unresolved disputes"; widgets can be added or removed | Notifications and charts share one page | Chart widgets **(UI unverified)** | **Medium-high**: proof that one home can carry both; owner-added widgets |
| 6 | Sentry Issues feed ([docs](https://docs.sentry.io/product/issues/)) | Dense table; per row: title, culprit, project tag, last seen, age, **trend sparkline** with a state word (Ongoing / Escalating), events, users, priority, assignee | Tabs For Review / Regressed / Escalating ([changelog](https://sentry.io/changelog/2023-9-21-find-trending-problems-faster-with-escalating-issues)) | Inline sparkline with 24h/90d toggle; a word under it | **High**: sparklines in counters, "escalating" vocabulary, source health rows |
| 7 | Things 3 Today ([features](https://culturedcode.com/things/features/)) | Calendar events "neatly grouped at the top of your Today list", to-dos below, a separate **This Evening** list | Time-of-day split, not by type | Badge counts in the sidebar only | **Medium-high**: "due today" block on top, calm whitespace |
| 8 | Sunsama ([home](https://www.sunsama.com/)) | Daily-planning ritual: "setting a realistic workload"; day columns with time estimates per task; calendar on the right; sidebar lists Daily planning / Daily shutdown / Daily highlights | Plan (mine) vs calendar (fixed) | Duration chips (4:00, 1:30) and channel tags (#product) | **Medium**: workload sum and a "close the day" idea |
| 9 | Notion Home ([help](https://www.notion.com/help/navigate-with-the-sidebar)) | "Home: Click to see the pages and tasks that need your attention"; sections Upcoming events, Recents, Favorites, Agents…; **Move up / Move down** per section | Sections, not lanes | none | **Medium**: let members reorder sections |
| 10 | Basecamp 5 ([basecamp.com/5](https://basecamp.com/5)) | "Action-oriented home screen": recent activity on the right, recently visited projects down the centre; **New For You** sidebar with Pings, Bubbled up, New for you | Separate sidebar for "for you"; **Bubble Up** defers an item to later today, tomorrow or next week | Orange count badges | **High**: snooze into tomorrow's Today; quiet side rail |
| 11 | Plane ([home](https://plane.so/), [v0.25.0 notes](https://newreleases.io/project/github/makeplane/plane/release/v0.25.0), [v2.5.0](https://plane.so/changelog/release-v2-5-0-new-widgets-mcp-connectors-plane-ai-for-self-hosted)) | Home with widget controls, Quicklinks, "Smart Recents"; mobile widgets for "due today, tomorrow, or this week" | Due buckets | Status glyphs coloured per state, label dots | **Medium**: due-bucket wording on phone |
| 12 | Apple Activity rings ([apple.com](https://www.apple.com/watch/close-your-rings/)) | Three goals as concentric rings, one hue each, on black | Progress towards a goal, not a list | Rings (sampled from the page: `#D20E42`, `#89D913`, `#00B5D6`) | **Medium**: one small "cleared today" ring, not a page of rings |
| 13 | Duolingo ([home](https://www.duolingo.com/), [colour page](https://design.duolingo.com/identity/color)) | Brand colours **named after animals** (Cardinal `#FF4B4B`, Bee `#FFC800`, Fox `#FF9600` from the search-indexed text of the official page, which redirected to the blog when I opened it; Feather Green `#58CC02`, Macaw `#1CB0F6`, Beetle `#CE82FF` from mirrors, unverified) | Logged-in home not seen **(unverified)** | Streaks and XP **(unverified, general knowledge)** | **Medium**: precedent for creature-named tokens; avoid streak pressure |
| 14 | Superhuman Go ([home](https://superhuman.com/)) | AI checker card "Payback period changed: …pays for itself in ~~14 months~~ 16 months", with "3 sources" and accept / reject | Change shown as an inline before→after diff | none | **High**: contract handoffs and narrative "what changed" |

### Per-reference notes

**1. Linear Inbox**: `shots/ref-linear-inbox-docs-d.png`
- Docs quote: the Priority tab "separates notifications that need your attention from other updates". Linear selects Priority by default.
- Snoozing "hides a notification from your Inbox until the selected time". Reminders notify without hiding.
- Display options: "Show snoozed", "Show unread first", what goes into the priority inbox, the badge count, "a preferred grouping".
- Rows in the published shot: avatar + key + title, a one-line reason in muted text ("Didier assigned the issue to you"), then a status glyph and age ("1h") at the inline end.
- Bold: the user defines what counts as "priority".
- Anti-pattern for Hub: Today must not become a second Inbox. Keep the "Other" part to a summary that links to the timeline.

**2. Linear My issues**: no separate shot (same docs shell as #1).
- Assigned tab groups in a fixed focus order: "urgent work, SLA-bound work, blockers, cycle work, other active work, triage, backlog, and completed work".
- Some sections "appear only when relevant". Inside a group: priority first, started issues rank higher.
- For Hub, Awaiting me order: escalated → overdue → due < 24 h → decisions → needs → handoffs → reviews. Hide empty groups.

**3. Linear Pulse**: `shots/ref-linear-pulse-docs-d.png`, `-m.png`
- The published shot shows a card "Daily pulse for Apr 16": an Initiatives heading, then a project name with its author and "2d ago", 3 to 4 bullets, then Projects with the same structure. A "Listen" pill sits at the top.
- Cadence: admin default ("Weekly on Mondays", every weekday, or never); each user can override.
- Lesson: the narrative is a structured digest, not a wall of prose. Headings per area plus 3 bullets beats paragraphs.
- Hub's `brief.sections` already gives that structure.

**4. GitHub dashboard + contribution calendar**: `shots/ref-github-contrib-torvalds-d.png`, `-m.png`
- Dashboard: "helps you track issues and pull requests, find your top repositories and teams, stay up-to-date…". Feeds "Following" and "For you" ([enterprise docs](https://docs.github.com/en/enterprise-server@3.14/account-and-profile/setting-up-and-managing-your-personal-account-on-github/managing-user-account-settings/about-your-personal-dashboard)).
- Calendar legend colours sampled from the shot: `#EFF2F5` (none) → `#ACEEBB` → `#4AC26B` → `#2DA44E` → `#116329`. This is a single-hue, 5-step ramp.
- There is a year switcher and a "Learn how we count contributions" link.
- On the 390 px phone the calendar scrolls sideways. Hub's phone layout should show only the last 2 weeks.

**5. Stripe Dashboard Home**: `shots/ref-stripe-dashboard-basics-d.png` (docs page only)
- Quote: "The Home page provides analytics and charts about your business performance. It also surfaces important notifications, like unresolved disputes or identity verifications."
- Widgets are added or removed, then "Apply". Hub can follow this for the owner-only team blocks.

**6. Sentry Issues feed**: `shots/ref-sentry-issues-docs-d.png`
- Each row has a small bar sparkline with a number at its end ("194"). The word "Ongoing" or "Escalating" sits under the sparkline, so the trend is named and not left to colour alone.
- The Priority sort shows "new issues and escalating issues… first" ([mirror of docs](https://qubitpi.github.io/sentry-docs/product/issues)).
- Anti-pattern: 9 columns is too dense for a phone-first Today. Take the sparkline-plus-word unit only.

**7. Things 3 Today**: `shots/ref-things-features-d.png`, `-m.png`; `ref-things-today-*.png` is only the hero
- The phone Today shows the calendar events in a tinted grey block at the top, to-dos below, then "This Evening" under a moon icon.
- Category colour sits only on the list icons: yellow star Today, red Upcoming, teal Anytime, beige Someday, green Logbook. Rows stay neutral.
- This is the calmest reference. It supports P2.

**8. Sunsama**: `shots/ref-sunsama-home-d.png`, `-m.png`
- The hero app shot shows day columns (Monday, Tuesday) with an "Add task" row and a total time ("8:00"). Each task card has a duration (4:00), sub-steps and a channel tag (#product, #growth). A calendar column sits on the right.
- Copy: "Plan your day with intention by aligning your goals, prioritizing tasks, and a setting a realistic workload."
- Hub idea: the sum of effort for my claimed and awaiting cards vs a daily budget. "Daily shutdown" could become an end-of-day card the agent reads next morning.

**9. Notion Home**: `shots/ref-notion-home-help-d.png`, `-m.png` (help page)
- Home sections can be moved up or down. My Tasks, Library and others are "always accessible at the bottom".
- An older version of the help article listed show/hide widgets ([search result](https://www.notion.com/help/home-and-my-tasks)).
- Hub: allow per-member section order. Keep Awaiting me locked first, as P3 requires.

**10. Basecamp 5**: `shots/ref-basecamp5-home-d.png`, `-m.png`
- The shot shows the "New For You" rail with three stacked sections:
  - Pings: an avatar row, then message snippets with orange count badges.
  - "Bubbled up": items the user deferred.
  - "New for you": with "Mark all read".
- Bubble Up: "mark it to Bubble Up later. Could be later today, tomorrow morning, later this week…".
- Also a "little peripheral vision nudge" 15 minutes before a meeting.
- Hub: "Bubble up to tomorrow" on any awaiting row, which returns it to the next Today. A quiet nudge for deadlines due within 1 h.

**11. Plane**: `shots/ref-plane-home-d.png`, `-m.png` (marketing; the cookie banner is visible, not accepted)
- The board in the hero shows state glyphs coloured per state: Planned is a blue outline circle, In Progress amber, In Review violet, Done green. Labels are a dot plus text ("• Backend").
- Home widgets come from the release notes, not seen **(unverified UI)**.

**12. Apple Activity rings**: `shots/ref-apple-close-rings-d.png`, `-m.png`
- Three rings for three goals. Closing a ring = goal reached. Each metric owns one hue.
- Evidence for a "completion" visual. Per ui-ux-pro-max, a ring needs a defined target. Hub has one: today's awaiting items, with target 0 left.

**13. Duolingo**: `shots/ref-duolingo-home-d.png`, `-m.png` (logged-out marketing)
- Relevant mostly for naming: a whole product palette named after animals (Macaw, Cardinal, Bee, Fox, Beetle). This is precedent for tokens like `--reef-coral` or `--peacock-eye`.
- Streak mechanics not seen **(unverified)**. For a 6–12 person work team, a personal streak or leaderboard risks pressure; show team totals instead.

**14. Superhuman Go**: `shots/ref-superhuman-home-d.png`
- The hero shows an AI card in a doc: "Payback period changed ⓘ / …pays for itself in ~~14 months.~~ **16 months.**", with "Knowledge Checker · 3 sources", ✓ / ✕ buttons and a follow-up input.
- Hub: render API-contract handoffs and narrative changes as before→after diffs with source chips (commit, PR, session).

### Recurring patterns (ranked by evidence)
1. **Split "needs my action" from "what happened"**: Linear Inbox Priority/Other, Basecamp 5 New For You rail, Stripe Home notifications plus charts, Notion Home "need your attention" (4 refs).
2. **Fixed focus order with groups that appear only when non-empty**: Linear My issues, Sentry priority sort, Things Today / This Evening, Plane due today/tomorrow/week (4 refs).
3. **Defer without losing**: snooze (Linear), Bubble Up (Basecamp), reminders (Linear), Someday (Things) (3 products).
4. **Scheduled, structured digest**: Linear Pulse at 6:00 local with bullets per project and audio; Sunsama and Akiflow daily-planning rituals ([akiflow.com/features](https://akiflow.com/features), via search) (3 refs).
5. **Small named trend next to the item**: Sentry sparkline plus a state word; GitHub calendar for long range; Apple rings for completion (3 refs).
6. **Member-configurable blocks**: Notion move up/down, Stripe widgets, Plane widget controls, Linear priority definition (4 refs).
7. **Colour for identity glyphs only, neutral rows**: Things list icons, Plane state glyphs, Sentry, Linear (4 refs).

---

## 2. Creature palettes (sampled from real photos)

**Method (reproducible).**
- Photos: Wikimedia Commons originals at 1000 px, licence read from the file metadata.
- Each photo is cropped to the animal, then converted to OKLab.
- Pixels with chroma > 0.045 are grouped into 15° hue families. Each family with ≥ 0.6 % of the crop gives one sample: the mean of its most chromatic 30 % of pixels. So every hex is a real averaged colour from the photo, not picked by eye.
- Neutrals: the 8th / 50th / 92nd lightness percentiles of the low-chroma pixels.
- Scripts are copied to `palette-tools/`: `download.py` fetches the photos and licences into `meta.json`; `palette2.py` samples; `mapui.py` maps to the UI; `final.py` + `specs.json` build the top-3 token sets; `swatch.py` draws the boards. They need Pillow, numpy and scikit-learn. Re-run order: `download.py`, `mapui.py out.md`, `final.py specs.json top3.md`.
- Visual evidence: `shots/palette-creatures-sampled.png`, the photo thumbnail and sampled swatches for all 11 creatures.

**UI mapping rule (the same for every creature, so palettes can be compared).**

The 11 slots use fixed target hues, so a colour keeps its meaning whichever palette is picked:

| slot | target hue | meaning |
|---|---|---|
| task | blue 262 | the most common type, steady |
| decision | gold 85 | attention, a choice |
| need | magenta 345 | an ask from a person |
| change | photo neutral, low chroma | machine-made, high volume, should be quiet |
| handoff | cyan 215 | flow between teams |
| redesign | violet 300 | creative work |
| doc | teal 170 | knowledge |
| release | lime-green 125 | shipped |
| success | green 150 | status |
| warning | orange 58 | status |
| danger | red 25 | status |

How each slot gets its colour:
- The closest sample within ±22° fills the slot. Each hue family serves one slot only.
- If no unused sample is in range, the slot is marked **ext**: it is filled at that hue with the photo's median chroma. A hue may be in the photo but already taken by a neighbouring slot; for example the peacock's rust went to warning, so danger became ext.
- Contrast adjustment moves only OKLCH lightness. Hue is kept, and chroma is clipped to the sRGB gamut.
  - **dot / fill**: at least 3:1 (WCAG 1.4.11 for non-text UI) on both `#F7F5F0` and `#121316`, so one value works in both themes.
  - **text on light**: at least 4.5:1 on `#F7F5F0`. That also passes on `#FFFFFF`, which is lighter.
  - **text on dark**: at least 4.5:1 on `#121316`.
- "Closest pair" is the smallest OKLab distance between the 8 type dots:
  - ≥ 0.10 is good;
  - 0.06–0.10 needs the icon + label, which Hub's `TypeBadge` always has;
  - below 0.06 is too close.

**General finding.** At equal lightness and about 0.11 chroma, 8 hues spaced around 45° apart cannot all be 0.10 ΔE from each other. Every palette lands at 0.06–0.10 for its closest pair. So in Hub the type colour must never be the only cue: keep the type icon and the label, which is P2 + §3.5 of doc 08.

### 2.1 Peacock (Indian peafowl, Pavo cristatus)

**Mood:** regal, jewel-toned, calm luxury. Low-chroma green-grey is 56 % of the crop; blue and cyan are small, precious accents. **Best use:** dark-first theme, where jewel accents glow on green-black. Magenta and violet are not in the photo.

Photo(s): [Peacock male (Pavo cristatus).jpg](https://commons.wikimedia.org/wiki/File:Peacock_male_(Pavo_cristatus).jpg) — Memurubu, CC BY-SA 4.0; [Peacock's tail (4525489101).jpg](https://commons.wikimedia.org/wiki/File:Peacock%27s_tail_(4525489101).jpg) — benjgibbs, CC BY 2.0

Sampled palette (OKLab hue-bin sampling of the subject crop; hex = mean of the most chromatic 30 % of pixels in that hue family):

| # | hex | OKLCH L / C / h | share of crop |
|---|---|---|---|
| 1 | `#A97250` | 0.60 / 0.085 / 53 | 1.3% |
| 2 | `#AB8A46` | 0.65 / 0.096 / 84 | 3.2% |
| 3 | `#A1A75A` | 0.71 / 0.101 / 113 | 11.2% |
| 4 | `#83A55A` | 0.68 / 0.109 / 129 | 15.3% |
| 5 | `#65A55D` | 0.66 / 0.122 / 142 | 16.6% |
| 6 | `#4AC3A2` | 0.74 / 0.118 / 172 | 4.9% |
| 7 | `#02D0FD` | 0.79 / 0.146 / 221 | 1.2% |
| 8 | `#2463D4` | 0.53 / 0.186 / 261 | 4.3% |
| 9 | `#10100C` | neutral dark | — |
| 10 | `#D2CFC0` | neutral light | — |

UI neutrals (tinted with the photo's neutral hue h≈137): light bg `#F5F8F3`, light surface `#FCFEFC`, light border `#DAE0D8`, light muted text `#5E665C`, dark bg `#0D100C`, dark surface `#171B15`, dark border `#2B2F29`, dark muted text `#9FA79C`

Primary/brand: sampled `#2463D4` → light-mode fill with white text `#2463D4` (5.5:1), dark-mode fill/link `#3979EC` (4.5:1 on #121316).

| slot | sampled from photo | CR of sample on #FFFFFF / #F7F5F0 / #121316 | dot/fill, both themes (≥3:1 on #F7F5F0 and #121316) | text on light (≥4.5 vs #F7F5F0, so also vs #FFF) | text on dark (≥4.5 vs #121316) |
|---|---|---|---|---|---|
| task | `#2463D4` h261 | 5.5 / 5.1 / 3.4 | `#2463D4` (5.1 / 3.4) | `#2463D4` (5.1) | `#3979EC` (4.5) |
| decision | `#AB8A46` h84 | 3.3 / 3.0 / 5.7 | `#A98844` (3.1 / 5.6) | `#8A6A24` (4.6) | `#A98844` (5.6) |
| need | `#B86797` **ext** (no unused photo sample within ±22°) | 3.9 / 3.6 / 4.8 | `#B86797` (3.6 / 4.8) | `#A45585` (4.6) | `#B86797` (4.8) |
| change | `#636B60` photo neutral | 5.5 / 5.1 / 3.4 | `#636B60` (5.1 / 3.4) | `#636B60` (5.1) | `#798176` (4.6) |
| handoff | `#02D0FD` h221 | 1.8 / 1.7 / 10.1 | `#009ABC` (3.0 / 5.6) | `#007B97` (4.5) | `#009ABC` (5.6) |
| redesign | `#9274C3` **ext** (no unused photo sample within ±22°) | 3.8 / 3.5 / 4.9 | `#9274C3` (3.5 / 4.9) | `#7F61AE` (4.6) | `#9274C3` (4.9) |
| doc | `#6ACCAC` h170 | 1.9 / 1.8 / 9.6 | `#389E80` (3.0 / 5.6) | `#037F63` (4.6) | `#389E80` (5.6) |
| release | `#83A55A` h129 | 2.8 / 2.6 / 6.6 | `#76974C` (3.1 / 5.6) | `#5B7A2F` (4.5) | `#76974C` (5.6) |
| success | `#4A9A5E` **ext** (no unused photo sample within ±22°) | 3.5 / 3.2 / 5.4 | `#4A9A5E` (3.2 / 5.4) | `#2C7E44` (4.6) | `#4A9A5E` (5.4) |
| warning | `#A97250` h53 | 4.0 / 3.7 / 4.6 | `#A97250` (3.7 / 4.6) | `#996342` (4.6) | `#A97250` (4.6) |
| danger | `#C46761` **ext** (no unused photo sample within ±22°) | 3.8 / 3.5 / 4.8 | `#C46761` (3.5 / 4.8) | `#B05550` (4.5) | `#C46761` (4.8) |

Closest pair of type dots: doc vs release, ΔE(OKLab) = 0.076 (acceptable only with icon + label, 0.06–0.10)

Coverage: 7/11 slots filled from distinct photo samples, 4 extended.


### 2.2 Mandarinfish (Synchiropus splendidus)

**Mood:** electric, psychedelic, a high-energy maze. Its blue is rare: S. splendidus is "one of only two vertebrate species known to have blue colouring because of cellular pigment" ([Wikipedia](https://en.wikipedia.org/wiki/Synchiropus_splendidus)). The pink sample comes from the soft coral behind the fish in the same photo. **Best use:** bold editorial look with an ink-blue brand.

Photo(s): [Synchiropus splendidus 2 Luc Viatour.jpg](https://commons.wikimedia.org/wiki/File:Synchiropus_splendidus_2_Luc_Viatour.jpg) — Luc Viatour, CC BY-SA 3.0

Sampled palette (OKLab hue-bin sampling of the subject crop; hex = mean of the most chromatic 30 % of pixels in that hue family):

| # | hex | OKLCH L / C / h | share of crop |
|---|---|---|---|
| 1 | `#8F393E` | 0.46 / 0.117 / 19 | 5.6% |
| 2 | `#AE5F28` | 0.57 / 0.123 / 52 | 6.5% |
| 3 | `#B8803D` | 0.64 / 0.109 / 68 | 6.8% |
| 4 | `#CA9D46` | 0.72 / 0.117 / 82 | 6.0% |
| 5 | `#587231` | 0.51 / 0.096 / 128 | 11.0% |
| 6 | `#08B5F5` | 0.73 / 0.150 / 233 | 1.6% |
| 7 | `#0037BF` | 0.42 / 0.217 / 263 | 11.0% |
| 8 | `#AB5379` | 0.56 / 0.122 / 355 | 1.1% |
| 9 | `#0C0908` | neutral dark | — |
| 10 | `#78776E` | neutral light | — |

UI neutrals (tinted with the photo's neutral hue h≈96): light bg `#F8F7F2`, light surface `#FEFDFB`, light border `#E0DED5`, light muted text `#666358`, dark bg `#110F0B`, dark surface `#1B1A13`, dark border `#2F2E27`, dark muted text `#A8A598`

Primary/brand: sampled `#0037BF` → light-mode fill with white text `#0037BF` (9.1:1), dark-mode fill/link `#3875FF` (4.6:1 on #121316).

| slot | sampled from photo | CR of sample on #FFFFFF / #F7F5F0 / #121316 | dot/fill, both themes (≥3:1 on #F7F5F0 and #121316) | text on light (≥4.5 vs #F7F5F0, so also vs #FFF) | text on dark (≥4.5 vs #121316) |
|---|---|---|---|---|---|
| task | `#0037BF` h263 | 9.1 / 8.4 / 2.0 | `#1C56DE` (5.6 / 3.0) | `#1C56DE` (5.6) | `#3875FF` (4.6) |
| decision | `#CA9D46` h82 | 2.5 / 2.3 / 7.5 | `#B3872D` (3.0 / 5.7) | `#936900` (4.5) | `#B3872D` (5.7) |
| need | `#AB5379` h355 | 4.9 / 4.5 / 3.8 | `#AB5379` (4.5 / 3.8) | `#AB5379` (4.5) | `#BA6086` (4.5) |
| change | `#676355` photo neutral | 6.0 / 5.5 / 3.1 | `#676355` (5.5 / 3.1) | `#676355` (5.5) | `#817D6E` (4.5) |
| handoff | `#11C3ED` h221 | 2.1 / 1.9 / 8.9 | `#009BBD` (3.0 / 5.7) | `#007B96` (4.5) | `#009BBD` (5.7) |
| redesign | `#9274C5` **ext** (no unused photo sample within ±22°) | 3.8 / 3.5 / 4.9 | `#9274C5` (3.5 / 4.9) | `#7F61B0` (4.5) | `#9274C5` (4.9) |
| doc | `#029D7B` **ext** (no unused photo sample within ±22°) | 3.4 / 3.2 / 5.4 | `#029D7B` (3.2 / 5.4) | `#008064` (4.5) | `#029D7B` (5.4) |
| release | `#587231` h128 | 5.4 / 5.0 / 3.4 | `#587231` (5.0 / 3.4) | `#587231` (5.0) | `#6C8746` (4.6) |
| success | `#489A5D` **ext** (no unused photo sample within ±22°) | 3.5 / 3.2 / 5.4 | `#489A5D` (3.2 / 5.4) | `#2C8045` (4.5) | `#489A5D` (5.4) |
| warning | `#AE5F28` h52 | 4.7 / 4.3 / 4.0 | `#AE5F28` (4.3 / 4.0) | `#A95B23` (4.6) | `#BA6934` (4.6) |
| danger | `#8F393E` h19 | 7.4 / 6.8 / 2.5 | `#9E464A` (5.6 / 3.0) | `#9E464A` (5.6) | `#BE6265` (4.5) |

Closest pair of type dots: change vs release, ΔE(OKLab) = 0.081 (acceptable only with icon + label, 0.06–0.10)

Coverage: 8/11 slots filled from distinct photo samples, 3 extended.


### 2.3 Panther chameleon (Furcifer pardalis)

**Mood:** earthy-tropical. Olive, lime, ochre and rust (Ambilobe male) plus mint-green (Nosy Be male). Few blues or violets. **Best use:** a warm accent family or a warm data-viz ramp; not a full 8-type set.

Photo(s): [Ambilobe panther chameleon.jpg](https://commons.wikimedia.org/wiki/File:Ambilobe_panther_chameleon.jpg) — Daniel Schwen, CC BY-SA 4.0; [Panther chameleon (Furcifer pardalis) male Nosy Be.jpg](https://commons.wikimedia.org/wiki/File:Panther_chameleon_(Furcifer_pardalis)_male_Nosy_Be.jpg) — Charles J. Sharp, CC BY-SA 4.0

Sampled palette (OKLab hue-bin sampling of the subject crop; hex = mean of the most chromatic 30 % of pixels in that hue family):

| # | hex | OKLCH L / C / h | share of crop |
|---|---|---|---|
| 1 | `#904F4A` | 0.50 / 0.089 / 25 | 0.8% |
| 2 | `#8C4A1C` | 0.48 / 0.106 / 52 | 8.2% |
| 3 | `#89681E` | 0.54 / 0.098 / 83 | 8.6% |
| 4 | `#857521` | 0.56 / 0.103 / 99 | 10.9% |
| 5 | `#828927` | 0.61 / 0.119 / 113 | 10.7% |
| 6 | `#486315` | 0.46 / 0.108 / 127 | 10.5% |
| 7 | `#6AB570` | 0.71 / 0.124 / 146 | 9.8% |
| 8 | `#5FB381` | 0.70 / 0.111 / 156 | 17.0% |
| 9 | `#040402` | neutral dark | — |
| 10 | `#DCDCCE` | neutral light | — |

UI neutrals (tinted with the photo's neutral hue h≈106): light bg `#F7F7F2`, light surface `#FEFEFB`, light border `#DFDFD6`, light muted text `#646458`, dark bg `#10100B`, dark surface `#1A1A14`, dark border `#2E2E27`, dark muted text `#A6A699`

Primary/brand: sampled `#5FB381` → light-mode fill with white text `#2D8455` (4.6:1), dark-mode fill/link `#5FB381` (7.3:1 on #121316).

| slot | sampled from photo | CR of sample on #FFFFFF / #F7F5F0 / #121316 | dot/fill, both themes (≥3:1 on #F7F5F0 and #121316) | text on light (≥4.5 vs #F7F5F0, so also vs #FFF) | text on dark (≥4.5 vs #121316) |
|---|---|---|---|---|---|
| task | `#5D85CE` **ext** (no unused photo sample within ±22°) | 3.7 / 3.4 / 5.1 | `#5D85CE` (3.4 / 5.1) | `#486EB5` (4.6) | `#5D85CE` (5.1) |
| decision | `#89681E` h83 | 5.2 / 4.7 / 3.6 | `#89681E` (4.7 / 3.6) | `#89681E` (4.7) | `#9A7831` (4.5) |
| need | `#B86797` **ext** (no unused photo sample within ±22°) | 3.9 / 3.6 / 4.8 | `#B86797` (3.6 / 4.8) | `#A45585` (4.6) | `#B86797` (4.8) |
| change | `#868682` photo neutral | 3.7 / 3.4 / 5.1 | `#868682` (3.4 / 5.1) | `#70706C` (4.6) | `#868682` (5.1) |
| handoff | `#0096AF` **ext** (no unused photo sample within ±22°) | 3.5 / 3.2 / 5.3 | `#0096AF` (3.2 / 5.3) | `#007A8F` (4.6) | `#0096AF` (5.3) |
| redesign | `#9274C3` **ext** (no unused photo sample within ±22°) | 3.8 / 3.5 / 4.9 | `#9274C3` (3.5 / 4.9) | `#7F61AE` (4.6) | `#9274C3` (4.9) |
| doc | `#61B898` h168 | 2.4 / 2.2 / 7.8 | `#459D7E` (3.0 / 5.6) | `#207E61` (4.6) | `#459D7E` (5.6) |
| release | `#486315` h127 | 6.8 / 6.3 / 2.7 | `#4F6A1E` (5.6 / 3.0) | `#4F6A1E` (5.6) | `#6A863C` (4.5) |
| success | `#4A9A5E` **ext** (no unused photo sample within ±22°) | 3.5 / 3.2 / 5.4 | `#4A9A5E` (3.2 / 5.4) | `#2C7E44` (4.6) | `#4A9A5E` (5.4) |
| warning | `#8C4A1C` h52 | 6.7 / 6.2 / 2.8 | `#925023` (5.7 / 3.0) | `#925023` (5.7) | `#B16C40` (4.5) |
| danger | `#904F4A` h25 | 6.2 / 5.7 / 3.0 | `#904F4A` (5.7 / 3.0) | `#904F4A` (5.7) | `#B06C66` (4.6) |

Closest pair of type dots: task vs redesign, ΔE(OKLab) = 0.080 (acceptable only with icon + label, 0.06–0.10)

Coverage: 6/11 slots filled from distinct photo samples, 5 extended.


### 2.4 Rainbow lorikeet (Trichoglossus moluccanus)

**Mood:** festive and warm-saturated: orange breast, yellow-green body, violet-blue head. The photo is in shade, so the samples are dimmer than memory suggests. **Best use:** playful accents. A full set would need chroma raised.

Photo(s): [Rainbow lorikeet (Trichoglossus moluccanus moluccanus) Sydney.jpg](https://commons.wikimedia.org/wiki/File:Rainbow_lorikeet_(Trichoglossus_moluccanus_moluccanus)_Sydney.jpg) — Charles J. Sharp, CC BY-SA 4.0

Sampled palette (OKLab hue-bin sampling of the subject crop; hex = mean of the most chromatic 30 % of pixels in that hue family):

| # | hex | OKLCH L / C / h | share of crop |
|---|---|---|---|
| 1 | `#A0492B` | 0.51 / 0.124 / 39 | 2.5% |
| 2 | `#C26E36` | 0.62 / 0.127 / 52 | 6.7% |
| 3 | `#BE7F36` | 0.65 / 0.117 / 67 | 6.0% |
| 4 | `#D09E34` | 0.73 / 0.132 / 82 | 4.0% |
| 5 | `#C8AE3A` | 0.75 / 0.134 / 96 | 4.6% |
| 6 | `#8F9539` | 0.64 / 0.115 / 113 | 7.2% |
| 7 | `#738D33` | 0.60 / 0.120 / 124 | 3.8% |
| 8 | `#52679D` | 0.52 / 0.089 / 267 | 5.7% |
| 9 | `#241F1B` | neutral dark | — |
| 10 | `#797A71` | neutral light | — |

UI neutrals (tinted with the photo's neutral hue h≈111): light bg `#F7F7F2`, light surface `#FDFEFB`, light border `#DEDFD6`, light muted text `#636459`, dark bg `#0F100B`, dark surface `#191A14`, dark border `#2E2E28`, dark muted text `#A4A699`

Primary/brand: sampled `#52679D` → light-mode fill with white text `#52679D` (5.5:1), dark-mode fill/link `#667CB3` (4.5:1 on #121316).

| slot | sampled from photo | CR of sample on #FFFFFF / #F7F5F0 / #121316 | dot/fill, both themes (≥3:1 on #F7F5F0 and #121316) | text on light (≥4.5 vs #F7F5F0, so also vs #FFF) | text on dark (≥4.5 vs #121316) |
|---|---|---|---|---|---|
| task | `#52679D` h267 | 5.5 / 5.1 / 3.3 | `#52679D` (5.1 / 3.3) | `#52679D` (5.1) | `#667CB3` (4.5) |
| decision | `#D09E34` h82 | 2.4 / 2.2 / 7.6 | `#B68508` (3.0 / 5.6) | `#916900` (4.6) | `#B68508` (5.6) |
| need | `#B96697` **ext** (no unused photo sample within ±22°) | 3.9 / 3.6 / 4.8 | `#B96697` (3.6 / 4.8) | `#A55485` (4.6) | `#B96697` (4.8) |
| change | `#636360` photo neutral | 6.0 / 5.5 / 3.1 | `#636360` (5.5 / 3.1) | `#636360` (5.5) | `#7E7E7B` (4.6) |
| handoff | `#0096AF` **ext** (no unused photo sample within ±22°) | 3.5 / 3.2 / 5.3 | `#0096AF` (3.2 / 5.3) | `#007A8F` (4.6) | `#0096AF` (5.3) |
| redesign | `#9274C4` **ext** (no unused photo sample within ±22°) | 3.8 / 3.5 / 4.9 | `#9274C4` (3.5 / 4.9) | `#7F61AF` (4.6) | `#9274C4` (4.9) |
| doc | `#0D9D7B` **ext** (no unused photo sample within ±22°) | 3.4 / 3.1 / 5.4 | `#0D9D7B` (3.1 / 5.4) | `#007F62` (4.6) | `#0D9D7B` (5.4) |
| release | `#738D33` h124 | 3.8 / 3.4 / 4.9 | `#738D33` (3.4 / 4.9) | `#60791C` (4.5) | `#738D33` (4.9) |
| success | `#499A5E` **ext** (no unused photo sample within ±22°) | 3.5 / 3.2 / 5.4 | `#499A5E` (3.2 / 5.4) | `#2B7E44` (4.6) | `#499A5E` (5.4) |
| warning | `#C26E36` h52 | 3.8 / 3.5 / 4.9 | `#C26E36` (3.5 / 4.9) | `#AC5A1F` (4.5) | `#C26E36` (4.9) |
| danger | `#C46761` **ext** (no unused photo sample within ±22°) | 3.8 / 3.5 / 4.8 | `#C46761` (3.5 / 4.8) | `#B05550` (4.5) | `#C46761` (4.8) |

Closest pair of type dots: handoff vs doc, ΔE(OKLab) = 0.089 (acceptable only with icon + label, 0.06–0.10)

Coverage: 5/11 slots filled from distinct photo samples, 6 extended.


### 2.5 Nudibranch (Chromodoris annae)

**Mood:** graphic, poster-like. One electric blue, a yellow-orange rim and black/white stripes (the white and black fall into the neutrals). **Best use:** a two-accent brand (blue + gold) on a neutral UI. Too few hues for 8 types.

Photo(s): [Babosa de mar (Chromodoris annae), Anilao, Filipinas, 2023-08-22, DD 53.jpg](https://commons.wikimedia.org/wiki/File:Babosa_de_mar_(Chromodoris_annae),_Anilao,_Filipinas,_2023-08-22,_DD_53.jpg) — Diego Delso, CC BY-SA 4.0

Sampled palette (OKLab hue-bin sampling of the subject crop; hex = mean of the most chromatic 30 % of pixels in that hue family):

| # | hex | OKLCH L / C / h | share of crop |
|---|---|---|---|
| 1 | `#7B5901` | 0.49 / 0.100 / 82 | 1.8% |
| 2 | `#7C7004` | 0.54 / 0.112 / 102 | 2.1% |
| 3 | `#9C9E2A` | 0.68 / 0.133 / 110 | 4.9% |
| 4 | `#84955C` | 0.64 / 0.081 / 122 | 0.9% |
| 5 | `#5188C1` | 0.61 / 0.105 / 250 | 2.1% |
| 6 | `#254EBD` | 0.47 / 0.181 / 265 | 14.7% |
| 7 | `#1A1B1D` | neutral dark | — |
| 8 | `#5F6967` | neutral light | — |

UI neutrals (tinted with the photo's neutral hue h≈182): light bg `#F2F8F7`, light surface `#FBFEFD`, light border `#D6E1DE`, light muted text `#586764`, dark bg `#0B1110`, dark surface `#131B1A`, dark border `#27302E`, dark muted text `#99A8A5`

Primary/brand: sampled `#254EBD` → light-mode fill with white text `#254EBD` (7.2:1), dark-mode fill/link `#4877E9` (4.5:1 on #121316).

| slot | sampled from photo | CR of sample on #FFFFFF / #F7F5F0 / #121316 | dot/fill, both themes (≥3:1 on #F7F5F0 and #121316) | text on light (≥4.5 vs #F7F5F0, so also vs #FFF) | text on dark (≥4.5 vs #121316) |
|---|---|---|---|---|---|
| task | `#254EBD` h265 | 7.2 / 6.6 / 2.6 | `#2F5BCB` (5.5 / 3.1) | `#2F5BCB` (5.5) | `#4877EA` (4.5) |
| decision | `#7B5901` h82 | 6.4 / 5.9 / 2.9 | `#7E5C07` (5.6 / 3.0) | `#7E5C07` (5.6) | `#9B782F` (4.5) |
| need | `#B86797` **ext** (no unused photo sample within ±22°) | 3.9 / 3.6 / 4.8 | `#B86797` (3.6 / 4.8) | `#A45585` (4.6) | `#B86797` (4.8) |
| change | `#626463` photo neutral | 6.0 / 5.5 / 3.1 | `#626463` (5.5 / 3.1) | `#626463` (5.5) | `#7C7E7D` (4.5) |
| handoff | `#0096AF` **ext** (no unused photo sample within ±22°) | 3.5 / 3.2 / 5.3 | `#0096AF` (3.2 / 5.3) | `#007A8F` (4.6) | `#0096AF` (5.3) |
| redesign | `#9274C3` **ext** (no unused photo sample within ±22°) | 3.8 / 3.5 / 4.9 | `#9274C3` (3.5 / 4.9) | `#7F61AE` (4.6) | `#9274C3` (4.9) |
| doc | `#109D7B` **ext** (no unused photo sample within ±22°) | 3.4 / 3.1 / 5.4 | `#109D7B` (3.1 / 5.4) | `#007F62` (4.6) | `#109D7B` (5.4) |
| release | `#84955C` h122 | 3.3 / 3.0 / 5.7 | `#83935B` (3.1 / 5.6) | `#677640` (4.5) | `#83935B` (5.6) |
| success | `#4A9A5E` **ext** (no unused photo sample within ±22°) | 3.5 / 3.2 / 5.4 | `#4A9A5E` (3.2 / 5.4) | `#2C7E44` (4.6) | `#4A9A5E` (5.4) |
| warning | `#BB7234` **ext** (no unused photo sample within ±22°) | 3.8 / 3.5 / 4.9 | `#BB7234` (3.5 / 4.9) | `#A65F1D` (4.5) | `#BB7234` (4.9) |
| danger | `#C46761` **ext** (no unused photo sample within ±22°) | 3.8 / 3.5 / 4.8 | `#C46761` (3.5 / 4.8) | `#B05550` (4.5) | `#C46761` (4.8) |

Closest pair of type dots: handoff vs doc, ΔE(OKLab) = 0.089 (acceptable only with icon + label, 0.06–0.10)

Coverage: 4/11 slots filled from distinct photo samples, 7 extended.


### 2.6 Hummingbirds (Anna's + violet sabrewing)

**Mood:** quiet sage and grey with a single jewel flash: the Anna's magenta gorget `#D1478E` and the sabrewing's violet-blue. **Best use:** the "one vivid accent on calm neutrals" model. Good for a brand colour, not a category set.

Photo(s): [Anna's hummingbird (Calypte anna) male in flight Campbell River.jpg](https://commons.wikimedia.org/wiki/File:Anna%27s_hummingbird_(Calypte_anna)_male_in_flight_Campbell_River.jpg) — Charles J. Sharp, CC BY-SA 4.0; [Violet sabrewing (Campylopterus hemileucurus mellitus) male in flight.jpg](https://commons.wikimedia.org/wiki/File:Violet_sabrewing_(Campylopterus_hemileucurus_mellitus)_male_in_flight.jpg) — Charles J. Sharp, CC BY-SA 4.0

Sampled palette (OKLab hue-bin sampling of the subject crop; hex = mean of the most chromatic 30 % of pixels in that hue family):

| # | hex | OKLCH L / C / h | share of crop |
|---|---|---|---|
| 1 | `#68633C` | 0.49 / 0.057 / 102 | 1.5% |
| 2 | `#444B25` | 0.40 / 0.058 / 117 | 6.9% |
| 3 | `#61743C` | 0.53 / 0.083 / 125 | 59.4% |
| 4 | `#3278BA` | 0.56 / 0.124 / 250 | 0.8% |
| 5 | `#335DB5` | 0.50 / 0.147 / 263 | 2.9% |
| 6 | `#D1478E` | 0.61 / 0.187 / 352 | 0.7% |
| 7 | `#1B1F14` | neutral dark | — |
| 8 | `#BAB4AF` | neutral light | — |

UI neutrals (tinted with the photo's neutral hue h≈77): light bg `#F9F6F2`, light surface `#FFFDFB`, light border `#E3DDD5`, light muted text `#696258`, dark bg `#120F0B`, dark surface `#1D1913`, dark border `#312D27`, dark muted text `#ABA398`

Primary/brand: sampled `#D1478E` → light-mode fill with white text `#CA4088` (4.6:1), dark-mode fill/link `#D34990` (4.5:1 on #121316).

| slot | sampled from photo | CR of sample on #FFFFFF / #F7F5F0 / #121316 | dot/fill, both themes (≥3:1 on #F7F5F0 and #121316) | text on light (≥4.5 vs #F7F5F0, so also vs #FFF) | text on dark (≥4.5 vs #121316) |
|---|---|---|---|---|---|
| task | `#335DB5` h263 | 6.2 / 5.7 / 3.0 | `#345FB7` (5.6 / 3.1) | `#345FB7` (5.6) | `#4E7CD7` (4.6) |
| decision | `#A87F0C` **ext** (no unused photo sample within ±22°) | 3.7 / 3.4 / 5.0 | `#A87F0C` (3.4 / 5.0) | `#8F6B00` (4.5) | `#A87F0C` (5.0) |
| need | `#D1478E` h352 | 4.2 / 3.9 / 4.4 | `#D1478E` (3.9 / 4.4) | `#C33982` (4.6) | `#D34990` (4.5) |
| change | `#8C857B` photo neutral | 3.6 / 3.3 / 5.1 | `#8C857B` (3.3 / 5.1) | `#766F65` (4.6) | `#8C857B` (5.1) |
| handoff | `#0096AF` **ext** (no unused photo sample within ±22°) | 3.5 / 3.2 / 5.3 | `#0096AF` (3.2 / 5.3) | `#007A8F` (4.6) | `#0096AF` (5.3) |
| redesign | `#9273C6` **ext** (no unused photo sample within ±22°) | 3.8 / 3.5 / 4.9 | `#9273C6` (3.5 / 4.9) | `#8061B2` (4.5) | `#9273C6` (4.9) |
| doc | `#009D7B` **ext** (no unused photo sample within ±22°) | 3.4 / 3.2 / 5.4 | `#009D7B` (3.2 / 5.4) | `#008064` (4.5) | `#009D7B` (5.4) |
| release | `#61743C` h125 | 5.2 / 4.7 / 3.6 | `#61743C` (4.7 / 3.6) | `#61743C` (4.7) | `#71844C` (4.5) |
| success | `#469B5D` **ext** (no unused photo sample within ±22°) | 3.4 / 3.2 / 5.4 | `#469B5D` (3.2 / 5.4) | `#277F43` (4.6) | `#469B5D` (5.4) |
| warning | `#BD712F` **ext** (no unused photo sample within ±22°) | 3.8 / 3.5 / 4.9 | `#BD712F` (3.5 / 4.9) | `#A85E15` (4.5) | `#BD712F` (4.9) |
| danger | `#C6655F` **ext** (no unused photo sample within ±22°) | 3.9 / 3.6 / 4.8 | `#C6655F` (3.6 / 4.8) | `#B2534E` (4.5) | `#C6655F` (4.8) |

Closest pair of type dots: handoff vs doc, ΔE(OKLab) = 0.089 (acceptable only with icon + label, 0.06–0.10)

Coverage: 4/11 slots filled from distinct photo samples, 7 extended.


### 2.7 Morpho butterfly (Morpho menelaus)

**Mood:** serene, monochrome azure to navy with brown borders (structural colour from wing scales). **Best use:** a primary ramp or the sequential heatmap scale. 8 of 11 slots are extended.

Photo(s): [Morpho menelaus huebneri MHNT Male Dos.jpg](https://commons.wikimedia.org/wiki/File:Morpho_menelaus_huebneri_MHNT_Male_Dos.jpg) — Didier Descouens, CC BY-SA 4.0

Sampled palette (OKLab hue-bin sampling of the subject crop; hex = mean of the most chromatic 30 % of pixels in that hue family):

| # | hex | OKLCH L / C / h | share of crop |
|---|---|---|---|
| 1 | `#51381F` | 0.36 / 0.053 / 66 | 5.0% |
| 2 | `#67CBD8` | 0.79 / 0.095 / 206 | 3.8% |
| 3 | `#60BFDA` | 0.76 / 0.097 / 218 | 18.0% |
| 4 | `#53A7D0` | 0.69 / 0.101 / 232 | 12.9% |
| 5 | `#427DB1` | 0.57 / 0.103 / 248 | 14.5% |
| 6 | `#3A598E` | 0.47 / 0.094 / 261 | 18.4% |
| 7 | `#3C4475` | 0.40 / 0.082 / 275 | 4.9% |
| 8 | `#423B64` | 0.38 / 0.069 / 290 | 0.9% |
| 9 | `#32221A` | neutral dark | — |
| 10 | `#AFAAA7` | neutral light | — |

UI neutrals (tinted with the photo's neutral hue h≈17): light bg `#FBF5F5`, light surface `#FFFDFD`, light border `#E6DBDB`, light muted text `#6D5F5F`, dark bg `#140E0E`, dark surface `#1F1717`, dark border `#342B2B`, dark muted text `#B0A0A0`

Primary/brand: sampled `#3A598E` → light-mode fill with white text `#3A598E` (7.0:1), dark-mode fill/link `#5D7EB6` (4.5:1 on #121316).

| slot | sampled from photo | CR of sample on #FFFFFF / #F7F5F0 / #121316 | dot/fill, both themes (≥3:1 on #F7F5F0 and #121316) | text on light (≥4.5 vs #F7F5F0, so also vs #FFF) | text on dark (≥4.5 vs #121316) |
|---|---|---|---|---|---|
| task | `#3A598E` h261 | 7.0 / 6.4 / 2.7 | `#426297` (5.6 / 3.0) | `#426297` (5.6) | `#5D7EB5` (4.5) |
| decision | `#A77F19` **ext** (no unused photo sample within ±22°) | 3.7 / 3.4 / 5.0 | `#A77F19` (3.4 / 5.0) | `#8F6B00` (4.5) | `#A77F19` (5.0) |
| need | `#B86797` **ext** (no unused photo sample within ±22°) | 3.9 / 3.6 / 4.8 | `#B86797` (3.6 / 4.8) | `#A45585` (4.6) | `#B86797` (4.8) |
| change | `#6D6060` photo neutral | 6.0 / 5.5 / 3.1 | `#6D6060` (5.5 / 3.1) | `#6D6060` (5.5) | `#877A7A` (4.5) |
| handoff | `#60BFDA` h218 | 2.1 / 1.9 / 8.8 | `#3699B3` (3.0 / 5.6) | `#007A94` (4.6) | `#3699B3` (5.6) |
| redesign | `#9274C3` **ext** (no unused photo sample within ±22°) | 3.8 / 3.5 / 4.9 | `#9274C3` (3.5 / 4.9) | `#7F61AE` (4.6) | `#9274C3` (4.9) |
| doc | `#109D7B` **ext** (no unused photo sample within ±22°) | 3.4 / 3.1 / 5.4 | `#109D7B` (3.1 / 5.4) | `#007F62` (4.6) | `#109D7B` (5.4) |
| release | `#76923B` **ext** (no unused photo sample within ±22°) | 3.5 / 3.2 / 5.3 | `#76923B` (3.2 / 5.3) | `#5E781E` (4.6) | `#76923B` (5.3) |
| success | `#4A9A5E` **ext** (no unused photo sample within ±22°) | 3.5 / 3.2 / 5.4 | `#4A9A5E` (3.2 / 5.4) | `#2C7E44` (4.6) | `#4A9A5E` (5.4) |
| warning | `#BB7234` **ext** (no unused photo sample within ±22°) | 3.8 / 3.5 / 4.9 | `#BB7234` (3.5 / 4.9) | `#A65F1D` (4.5) | `#BB7234` (4.9) |
| danger | `#C46761` **ext** (no unused photo sample within ±22°) | 3.8 / 3.5 / 4.8 | `#C46761` (3.5 / 4.8) | `#B05550` (4.5) | `#C46761` (4.8) |

Closest pair of type dots: decision vs release, ΔE(OKLab) = 0.082 (acceptable only with icon + label, 0.06–0.10)

Coverage: 3/11 slots filled from distinct photo samples, 8 extended.


### 2.8 Parrotfish (queen parrotfish, Scarus vetula)

**Mood:** fresh, cool aquatic turquoise and teal on sand. **Best use:** a cool family for handoff, doc and info, plus neutrals. Warm slots are extended, and decision and release collapse into similar muted olives (ΔE 0.035), so avoid it as-is.

Photo(s): [Queen parrotfish Scarus vetula terminal phase (3471718081).jpg](https://commons.wikimedia.org/wiki/File:Queen_parrotfish_Scarus_vetula_terminal_phase_(3471718081).jpg) — Paul Asman and Jill Lenoble, CC BY 2.0

Sampled palette (OKLab hue-bin sampling of the subject crop; hex = mean of the most chromatic 30 % of pixels in that hue family):

| # | hex | OKLCH L / C / h | share of crop |
|---|---|---|---|
| 1 | `#8D6A43` | 0.55 / 0.071 / 69 | 0.9% |
| 2 | `#A28856` | 0.64 / 0.075 / 84 | 1.7% |
| 3 | `#A3965D` | 0.67 / 0.078 / 97 | 1.6% |
| 4 | `#7DD4BD` | 0.81 / 0.091 / 175 | 1.8% |
| 5 | `#6FDCD4` | 0.83 / 0.101 / 189 | 9.4% |
| 6 | `#50D3DF` | 0.80 / 0.114 / 204 | 6.5% |
| 7 | `#2DC5E7` | 0.76 / 0.128 / 218 | 6.8% |
| 8 | `#0D6B92` | 0.50 / 0.100 / 234 | 22.6% |
| 9 | `#1C1E23` | neutral dark | — |
| 10 | `#DBECE4` | neutral light | — |

UI neutrals (tinted with the photo's neutral hue h≈126): light bg `#F5F8F3`, light surface `#FDFEFC`, light border `#DCE0D7`, light muted text `#60655A`, dark bg `#0E100C`, dark surface `#181B15`, dark border `#2C2F29`, dark muted text `#A2A79B`

Primary/brand: sampled `#0D6B92` → light-mode fill with white text `#0D6B92` (5.9:1), dark-mode fill/link `#3486AE` (4.6:1 on #121316).

| slot | sampled from photo | CR of sample on #FFFFFF / #F7F5F0 / #121316 | dot/fill, both themes (≥3:1 on #F7F5F0 and #121316) | text on light (≥4.5 vs #F7F5F0, so also vs #FFF) | text on dark (≥4.5 vs #121316) |
|---|---|---|---|---|---|
| task | `#044D7A` h244 | 8.9 / 8.2 / 2.1 | `#286796` (5.6 / 3.1) | `#286796` (5.6) | `#4683B4` (4.6) |
| decision | `#A28856` h84 | 3.4 / 3.1 / 5.5 | `#A28856` (3.1 / 5.5) | `#876D3C` (4.5) | `#A28856` (5.5) |
| need | `#B86797` **ext** (no unused photo sample within ±22°) | 3.9 / 3.6 / 4.8 | `#B86797` (3.6 / 4.8) | `#A45585` (4.6) | `#B86797` (4.8) |
| change | `#84887F` photo neutral | 3.6 / 3.3 / 5.1 | `#84887F` (3.3 / 5.1) | `#6E7269` (4.5) | `#84887F` (5.1) |
| handoff | `#2DC5E7` h218 | 2.0 / 1.9 / 9.1 | `#009AB7` (3.1 / 5.6) | `#007B93` (4.5) | `#009AB7` (5.6) |
| redesign | `#9274C3` **ext** (no unused photo sample within ±22°) | 3.8 / 3.5 / 4.9 | `#9274C3` (3.5 / 4.9) | `#7F61AE` (4.6) | `#9274C3` (4.9) |
| doc | `#7DD4BD` h175 | 1.7 / 1.6 / 10.6 | `#449C87` (3.0 / 5.6) | `#1F7E6A` (4.5) | `#449C87` (5.6) |
| release | `#9D9F69` h111 | 2.8 / 2.5 / 6.7 | `#8F915C` (3.0 / 5.6) | `#72733F` (4.5) | `#8F915C` (5.6) |
| success | `#4A9A5E` **ext** (no unused photo sample within ±22°) | 3.5 / 3.2 / 5.4 | `#4A9A5E` (3.2 / 5.4) | `#2C7E44` (4.6) | `#4A9A5E` (5.4) |
| warning | `#BB7234` **ext** (no unused photo sample within ±22°) | 3.8 / 3.5 / 4.9 | `#BB7234` (3.5 / 4.9) | `#A65F1D` (4.5) | `#BB7234` (4.9) |
| danger | `#C46761` **ext** (no unused photo sample within ±22°) | 3.8 / 3.5 / 4.8 | `#C46761` (3.5 / 4.8) | `#B05550` (4.5) | `#C46761` (4.8) |

Closest pair of type dots: decision vs release, ΔE(OKLab) = 0.035 (**too close**, < 0.06)

Coverage: 6/11 slots filled from distinct photo samples, 5 extended.


### 2.9 Rainbow eucalyptus bark (Eucalyptus deglupta)

**Mood:** painterly and soft: lime-green, coral-salmon, maroon, warm grey. **Best use:** warm soft tints and the neutral "change" family. 7 slots are extended.

Photo(s): [Starr-130214-1575-Eucalyptus deglupta-bark-Waihee-Maui (25112573891).jpg](https://commons.wikimedia.org/wiki/File:Starr-130214-1575-Eucalyptus_deglupta-bark-Waihee-Maui_(25112573891).jpg) — Forest and Kim Starr, CC BY 3.0 us

Sampled palette (OKLab hue-bin sampling of the subject crop; hex = mean of the most chromatic 30 % of pixels in that hue family):

| # | hex | OKLCH L / C / h | share of crop |
|---|---|---|---|
| 1 | `#B46872` | 0.60 / 0.098 / 12 | 2.9% |
| 2 | `#C86A63` | 0.63 / 0.121 / 25 | 11.1% |
| 3 | `#AB795B` | 0.62 / 0.076 / 51 | 1.4% |
| 4 | `#929B5D` | 0.67 / 0.084 / 116 | 0.9% |
| 5 | `#85AA4C` | 0.69 / 0.129 / 127 | 32.1% |
| 6 | `#577E49` | 0.55 / 0.090 / 138 | 1.2% |
| 7 | `#3E3E3D` | neutral dark | — |
| 8 | `#A09E9E` | neutral light | — |

UI neutrals (tinted with the photo's neutral hue h≈17): light bg `#FBF5F5`, light surface `#FFFDFD`, light border `#E6DBDB`, light muted text `#6D5F5F`, dark bg `#140E0E`, dark surface `#1F1717`, dark border `#342B2C`, dark muted text `#B0A0A0`

Primary/brand: sampled `#85AA4C` → light-mode fill with white text `#5E801E` (4.6:1), dark-mode fill/link `#85AA4C` (6.9:1 on #121316).

| slot | sampled from photo | CR of sample on #FFFFFF / #F7F5F0 / #121316 | dot/fill, both themes (≥3:1 on #F7F5F0 and #121316) | text on light (≥4.5 vs #F7F5F0, so also vs #FFF) | text on dark (≥4.5 vs #121316) |
|---|---|---|---|---|---|
| task | `#5D85CE` **ext** (no unused photo sample within ±22°) | 3.7 / 3.4 / 5.1 | `#5D85CE` (3.4 / 5.1) | `#486EB5` (4.6) | `#5D85CE` (5.1) |
| decision | `#A77F19` **ext** (no unused photo sample within ±22°) | 3.7 / 3.4 / 5.0 | `#A77F19` (3.4 / 5.0) | `#8F6B00` (4.5) | `#A77F19` (5.0) |
| need | `#B86797` **ext** (no unused photo sample within ±22°) | 3.9 / 3.6 / 4.8 | `#B86797` (3.6 / 4.8) | `#A45585` (4.6) | `#B86797` (4.8) |
| change | `#6F6B6B` photo neutral | 5.3 / 4.8 / 3.5 | `#6F6B6B` (4.8 / 3.5) | `#6F6B6B` (4.8) | `#817C7C` (4.5) |
| handoff | `#0096AF` **ext** (no unused photo sample within ±22°) | 3.5 / 3.2 / 5.3 | `#0096AF` (3.2 / 5.3) | `#007A8F` (4.6) | `#0096AF` (5.3) |
| redesign | `#9274C3` **ext** (no unused photo sample within ±22°) | 3.8 / 3.5 / 4.9 | `#9274C3` (3.5 / 4.9) | `#7F61AE` (4.6) | `#9274C3` (4.9) |
| doc | `#109D7B` **ext** (no unused photo sample within ±22°) | 3.4 / 3.1 / 5.4 | `#109D7B` (3.1 / 5.4) | `#007F62` (4.6) | `#109D7B` (5.4) |
| release | `#85AA4C` h127 | 2.7 / 2.5 / 6.9 | `#75993A` (3.0 / 5.6) | `#587A15` (4.6) | `#75993A` (5.6) |
| success | `#4A9A5E` **ext** (no unused photo sample within ±22°) | 3.5 / 3.2 / 5.4 | `#4A9A5E` (3.2 / 5.4) | `#2C7E44` (4.6) | `#4A9A5E` (5.4) |
| warning | `#AB795B` h51 | 3.7 / 3.4 / 5.0 | `#AB795B` (3.4 / 5.0) | `#956447` (4.6) | `#AB795B` (5.0) |
| danger | `#C86A63` h25 | 3.7 / 3.4 / 5.0 | `#C86A63` (3.4 / 5.0) | `#B1554F` (4.5) | `#C86A63` (5.0) |

Closest pair of type dots: task vs redesign, ΔE(OKLab) = 0.080 (acceptable only with icon + label, 0.06–0.10)

Coverage: 4/11 slots filled from distinct photo samples, 7 extended.


### 2.10 Coral reef (Palmyra Atoll + Red Sea)

**Mood:** the whole spectrum against sand and deep water: reef blue, sky, lagoon teal, coral pink, crimson, ochre, algae, deep violet. **Best use:** the only photo set covering all 11 slots; light-first with sand neutrals. The Red Sea photo ties to Goteav's markets (Egypt, Gulf).

Photo(s): [Colorful underwater landscape of a coral reef.jpg](https://commons.wikimedia.org/wiki/File:Colorful_underwater_landscape_of_a_coral_reef.jpg) — Jim E Maragos, U.S. Fish and Wildlife Service, Public domain; [كنز الحيد المرجاني . بالبحر الأحمر.jpg](https://commons.wikimedia.org/wiki/File:%D9%83%D9%86%D8%B2_%D8%A7%D9%84%D8%AD%D9%8A%D8%AF_%D8%A7%D9%84%D9%85%D8%B1%D8%AC%D8%A7%D9%86%D9%8A_._%D8%A8%D8%A7%D9%84%D8%A8%D8%AD%D8%B1_%D8%A7%D9%84%D8%A3%D8%AD%D9%85%D8%B1.jpg) — Pretty Dodo, CC BY-SA 4.0

Sampled palette (OKLab hue-bin sampling of the subject crop; hex = mean of the most chromatic 30 % of pixels in that hue family):

| # | hex | OKLCH L / C / h | share of crop |
|---|---|---|---|
| 1 | `#852326` | 0.41 / 0.133 / 24 | 6.4% |
| 2 | `#BBAA5F` | 0.74 / 0.098 / 96 | 7.7% |
| 3 | `#20AEB8` | 0.69 / 0.111 / 202 | 3.9% |
| 4 | `#13B1FB` | 0.72 / 0.157 / 238 | 12.3% |
| 5 | `#0951DE` | 0.50 / 0.224 / 262 | 21.3% |
| 6 | `#2E2054` | 0.29 / 0.090 / 292 | 5.1% |
| 7 | `#2F1134` | 0.24 / 0.073 / 322 | 4.4% |
| 8 | `#AD366F` | 0.52 / 0.164 / 355 | 3.2% |
| 9 | `#020101` | neutral dark | — |
| 10 | `#F9F6ED` | neutral light | — |

UI neutrals (tinted with the photo's neutral hue h≈55): light bg `#FBF6F2`, light surface `#FFFDFC`, light border `#E5DCD7`, light muted text `#6C615A`, dark bg `#130E0B`, dark surface `#1E1814`, dark border `#332C28`, dark muted text `#AEA29A`

Primary/brand: sampled `#0951DE` → light-mode fill with white text `#0951DE` (6.5:1), dark-mode fill/link `#3175FF` (4.5:1 on #121316).

| slot | sampled from photo | CR of sample on #FFFFFF / #F7F5F0 / #121316 | dot/fill, both themes (≥3:1 on #F7F5F0 and #121316) | text on light (≥4.5 vs #F7F5F0, so also vs #FFF) | text on dark (≥4.5 vs #121316) |
|---|---|---|---|---|---|
| task | `#0951DE` h262 | 6.5 / 5.9 / 2.9 | `#1056E3` (5.6 / 3.1) | `#1056E3` (5.6) | `#3175FF` (4.5) |
| decision | `#9D7C35` h84 | 3.9 / 3.6 / 4.7 | `#9D7C35` (3.6 / 4.7) | `#8B6A21` (4.6) | `#9D7C35` (4.7) |
| need | `#AD366F` h355 | 5.9 / 5.5 / 3.1 | `#AD366F` (5.5 / 3.1) | `#AD366F` (5.5) | `#CC538A` (4.6) |
| change | `#69625D` photo neutral | 6.0 / 5.5 / 3.1 | `#69625D` (5.5 / 3.1) | `#69625D` (5.5) | `#837C77` (4.5) |
| handoff | `#1494AE` h217 | 3.6 / 3.3 / 5.2 | `#1494AE` (3.3 / 5.2) | `#007A91` (4.6) | `#1494AE` (5.2) |
| redesign | `#301643` h307 | 15.9 / 14.6 / 1.2 | `#715689` (5.7 / 3.0) | `#715689` (5.7) | `#8F73A8` (4.6) |
| doc | `#369D86` h175 | 3.3 / 3.0 / 5.6 | `#369D86` (3.0 / 5.6) | `#007E69` (4.6) | `#369D86` (5.6) |
| release | `#A4A770` h111 | 2.5 / 2.3 / 7.4 | `#8F915B` (3.0 / 5.6) | `#72733E` (4.5) | `#8F915B` (5.6) |
| success | `#41643D` h142 | 6.7 / 6.2 / 2.8 | `#476A42` (5.7 / 3.0) | `#476A42` (5.7) | `#62865D` (4.5) |
| warning | `#87502C` h52 | 6.5 / 6.0 / 2.8 | `#8C5430` (5.6 / 3.0) | `#8C5430` (5.6) | `#AA704B` (4.5) |
| danger | `#852326` h24 | 9.3 / 8.5 / 2.0 | `#A44140` (5.7 / 3.0) | `#A44140` (5.7) | `#C45E5B` (4.5) |

Closest pair of type dots: decision vs release, ΔE(OKLab) = 0.059 (**too close**, < 0.06)

Coverage: 11/11 slots filled from distinct photo samples, 0 extended.


### 2.11 Gouldian finch (Erythrura gouldiae)

**Mood:** flat colour blocks: red face, purple chest, yellow belly, green back. The turquoise collar fell outside the crop. **Best use:** a bold editorial alternative to the mandarinfish; the blocks read well as large tiles.

Photo(s): [Erythrura gouldiae -Artis Zoo -Netherlands -male-8a.jpg](https://commons.wikimedia.org/wiki/File:Erythrura_gouldiae_-Artis_Zoo_-Netherlands_-male-8a.jpg) — Arjan Haverkamp, CC BY 2.0

Sampled palette (OKLab hue-bin sampling of the subject crop; hex = mean of the most chromatic 30 % of pixels in that hue family):

| # | hex | OKLCH L / C / h | share of crop |
|---|---|---|---|
| 1 | `#C1321B` | 0.54 / 0.183 / 32 | 1.8% |
| 2 | `#C68354` | 0.67 / 0.104 / 55 | 1.2% |
| 3 | `#CA9402` | 0.70 / 0.144 / 82 | 17.5% |
| 4 | `#9E8520` | 0.62 / 0.117 / 94 | 6.6% |
| 5 | `#606906` | 0.50 / 0.110 / 115 | 25.8% |
| 6 | `#56375E` | 0.39 / 0.074 / 319 | 8.3% |
| 7 | `#4F2F48` | 0.35 / 0.061 / 335 | 0.8% |
| 8 | `#1E180A` | neutral dark | — |
| 9 | `#F5F4F9` | neutral light | — |

UI neutrals (tinted with the photo's neutral hue h≈295): light bg `#F7F6FB`, light surface `#FDFDFF`, light border `#DEDDE5`, light muted text `#64616D`, dark bg `#100F13`, dark surface `#1A181E`, dark border `#2E2D33`, dark muted text `#A5A3AF`

Primary/brand: sampled `#56375E` → light-mode fill with white text `#56375E` (10.0:1), dark-mode fill/link `#94729C` (4.6:1 on #121316).

| slot | sampled from photo | CR of sample on #FFFFFF / #F7F5F0 / #121316 | dot/fill, both themes (≥3:1 on #F7F5F0 and #121316) | text on light (≥4.5 vs #F7F5F0, so also vs #FFF) | text on dark (≥4.5 vs #121316) |
|---|---|---|---|---|---|
| task | `#5D85CE` **ext** (no unused photo sample within ±22°) | 3.7 / 3.4 / 5.1 | `#5D85CE` (3.4 / 5.1) | `#486EB5` (4.6) | `#5D85CE` (5.1) |
| decision | `#CA9402` h82 | 2.7 / 2.5 / 6.9 | `#B78600` (3.0 / 5.7) | `#906900` (4.6) | `#B78600` (5.7) |
| need | `#B86797` **ext** (no unused photo sample within ±22°) | 3.9 / 3.6 / 4.8 | `#B86797` (3.6 / 4.8) | `#A45585` (4.6) | `#B86797` (4.8) |
| change | `#86858A` photo neutral | 3.7 / 3.4 / 5.1 | `#86858A` (3.4 / 5.1) | `#717075` (4.5) | `#86858A` (5.1) |
| handoff | `#0096AF` **ext** (no unused photo sample within ±22°) | 3.5 / 3.2 / 5.3 | `#0096AF` (3.2 / 5.3) | `#007A8F` (4.6) | `#0096AF` (5.3) |
| redesign | `#4B3159` h313 | 11.2 / 10.2 / 1.7 | `#725782` (5.7 / 3.0) | `#725782` (5.7) | `#9074A1` (4.6) |
| doc | `#109D7B` **ext** (no unused photo sample within ±22°) | 3.4 / 3.1 / 5.4 | `#109D7B` (3.1 / 5.4) | `#007F62` (4.6) | `#109D7B` (5.4) |
| release | `#5B6F23` h123 | 5.6 / 5.1 / 3.3 | `#5B6F23` (5.1 / 3.3) | `#5B6F23` (5.1) | `#70853B` (4.5) |
| success | `#4A9A5E` **ext** (no unused photo sample within ±22°) | 3.5 / 3.2 / 5.4 | `#4A9A5E` (3.2 / 5.4) | `#2C7E44` (4.6) | `#4A9A5E` (5.4) |
| warning | `#C68354` h55 | 3.1 / 2.8 / 6.0 | `#C17E4F` (3.0 / 5.6) | `#A16031` (4.6) | `#C17E4F` (5.6) |
| danger | `#AA261C` h29 | 7.0 / 6.4 / 2.7 | `#B43126` (5.7 / 3.0) | `#B43126` (5.7) | `#D55143` (4.5) |

Closest pair of type dots: handoff vs doc, ΔE(OKLab) = 0.089 (acceptable only with icon + label, 0.06–0.10)

Coverage: 6/11 slots filled from distinct photo samples, 5 extended.

---

## 3. Top-3 recommendation (calm-but-vivid, used all day)

Selection criteria:
1. How many of the 11 slots the photo really covers.
2. Whether its neutrals are usable as a page background.
3. Whether the vivid hues survive the contrast adjustment without turning muddy. That was Stripe's complaint: "dark and muddy and it's difficult to tell the hues apart".
4. Mood for a tool people read many times a day.

| rank | creature | coverage | closest type pair (ΔE ok) | best for | why |
|---|---|---|---|---|---|
| 1 | **Coral reef**: Palmyra Atoll (public domain) + Red Sea (CC BY-SA 4.0) | **11/11** | 0.075 handoff–doc | **(b) light-first** | The only photo set with every hue. Its sampled light neutral `#F9F6ED` is almost the brief's `#F7F5F0`, so the page reads as sand. The Red Sea photo ties the palette to Goteav's markets (Egypt, Gulf). |
| 2 | **Peacock** (Indian peafowl) | 7/11 in the mechanical map. The hand-tuned set below takes rust (danger) and green (success) from the photo, so only need + redesign stay extended. | 0.071 decision–release | **(a) dark-first** | Jewel tones (neck blue, eye cyan, tail teal, bronze) were made to glow against dark plumage. On a green-black `#0B100C` they read luminous but calm, because 56 % of the photo is low-chroma green-grey. |
| 3 | **Mandarinfish** | 8/11 | 0.095 handoff–doc (best separation) | **(c) bold editorial** | Electric blue (one of only two vertebrates known to make blue with a pigment, [Wikipedia](https://en.wikipedia.org/wiki/Synchiropus_splendidus)), orange, yellow and green lines in a maze. Strong ink-blue plus cream paper gives a magazine look; flat strong accents work as large tiles. |
| runner-up | Gouldian finch | 6/11 | 0.089 | (c) alternative | Flat colour blocks (red, purple, yellow, green): poster-like, but our crop missed the turquoise collar. |

Below are the tuned token sets.
- Each hex starts from a photo sample. "raised", "lightened" and "nudged" mark OKLCH edits.
- Soft tints are L 0.955 (light) and L 0.275 (dark), with chroma ≤ 0.045 / 0.05.
- Badge text was checked against its own soft tint, not only against the page.

Visual boards (light and dark side by side):
- `shots/palette-top1-reef.png`
- `shots/palette-top2-peacock.png`
- `shots/palette-top3-mandarin.png`

### A. Reef & Sand (coral reef: Palmyra Atoll + Red Sea) - light-first

| token | light | dark |
|---|---|---|
| bg | `#F9F6ED` | `#0F0F15` |
| surface | `#FFFEFB` | `#181821` |
| border | `#E2DED2` | `#2F2F38` |
| text | `#1E1A15` | `#EEEBE4` |
| muted | `#6B6157` | `#A6A7B1` |
| text contrast | 16.0:1 | 16.0:1 |
| muted contrast | 5.6:1 | 8.0:1 |
| primary (fill) | `#0951DE` + white text 6.5:1 | `#5C9EFF` + `#080F1C` text 7.1:1 |

| slot | sampled | dot / stripe (both themes) | CR dot on light bg / dark bg | badge text light (on soft) | badge text dark (on soft) | soft light / soft dark |
|---|---|---|---|---|---|---|
| task | `#0951DE` Red Sea open water h262 | `#1056E3` | 5.6 / 3.1 | `#1056E3` (5.3 on soft, 5.6 on #F7F5F0) | `#4D89FF` (4.5 on soft, 5.6 on #121316) | `#E9F1FF` / `#1A2740` |
| decision | `#9D7C35` Palmyra ochre coral h84 | `#9D7C35` | 3.6 / 4.9 | `#88671D` (4.6 on soft, 4.8 on #F7F5F0) | `#AB8A43` (4.6 on soft, 5.7 on #121316) | `#FFEECF` / `#332506` |
| need | `#AD366F` Palmyra coral pink h355 | `#AD366F` | 5.5 / 3.2 | `#AD366F` (5.2 on soft, 5.5 on #F7F5F0) | `#DD6299` (4.5 on soft, 5.6 on #121316) | `#FFEAF1` / `#3B1D29` |
| change | `#69625D` wet rock neutral | `#69625D` | 5.5 / 3.2 | `#69625D` (5.2 on soft, 5.5 on #F7F5F0) | `#948C87` (4.5 on soft, 5.6 on #121316) | `#F7EEE8` / `#2C2622` |
| handoff | `#1494AE` lagoon h215 | `#1494AE` | 3.3 / 5.3 | `#00778D` (4.6 on soft, 4.8 on #F7F5F0) | `#239CB6` (4.5 on soft, 5.8 on #121316) | `#D8F6FF` / `#002D37` |
| redesign | `#2E2054` deep-water violet h292, lightened | `#7764B9` | 4.5 / 3.9 | `#7360B4` (4.5 on soft, 4.7 on #F7F5F0) | `#9381D8` (4.6 on soft, 5.6 on #121316) | `#F0EEFF` / `#28233E` |
| doc | `#369D86` seagrass teal h172 | `#369D86` | 3.1 / 5.8 | `#007D67` (4.5 on soft, 4.7 on #F7F5F0) | `#389F87` (4.5 on soft, 5.7 on #121316) | `#D2FBEE` / `#022F26` |
| release | `#728557` algae green h128, chroma raised | `#6A8A33` | 3.7 / 4.8 | `#58761C` (4.6 on soft, 4.8 on #F7F5F0) | `#799943` (4.5 on soft, 5.7 on #121316) | `#E8F6D6` / `#212C0F` |
| success | `#428462` seagrass green h158 | `#428462` | 4.1 / 4.3 | `#397B5A` (4.5 on soft, 4.6 on #F7F5F0) | `#5C9E7B` (4.6 on soft, 5.9 on #121316) | `#D8FAE6` / `#0D2F1F` |
| warning | `#87502C` sponge orange h52, chroma raised, hue moved to 45 | `#BE6438` | 3.8 / 4.6 | `#AC5326` (4.6 on soft, 4.8 on #F7F5F0) | `#D17549` (4.5 on soft, 5.6 on #121316) | `#FFECE3` / `#3C1F12` |
| danger | `#852326` red coral h24 | `#A44140` | 5.7 / 3.1 | `#A44140` (5.4 on soft, 5.7 on #F7F5F0) | `#D76E6B` (4.6 on soft, 5.6 on #121316) | `#FFEBE9` / `#3D1D1C` |

Type-dot separation: closest handoff–doc ΔE_ok 0.075; next decision–release 0.084; median 0.177.
Closest status↔type: success–release 0.073; success–doc 0.077.

### B. Night Peacock (Indian peafowl) - dark-first

| token | light | dark |
|---|---|---|
| bg | `#F4F8F3` | `#0B100C` |
| surface | `#FDFFFD` | `#131914` |
| border | `#D9E1D8` | `#29302A` |
| text | `#141A15` | `#E4EAE2` |
| muted | `#5A635B` | `#9EA89F` |
| text contrast | 16.5:1 | 15.7:1 |
| muted contrast | 5.8:1 | 7.8:1 |
| primary (fill) | `#006F83` + white text 5.8:1 | `#02D0FD` + `#001218` text 10.4:1 |

| slot | sampled | dot / stripe (both themes) | CR dot on light bg / dark bg | badge text light (on soft) | badge text dark (on soft) | soft light / soft dark |
|---|---|---|---|---|---|---|
| task | `#2463D4` neck blue h261 | `#2463D4` | 5.1 / 3.5 | `#2463D4` (4.8 on soft, 5.1 on #F7F5F0) | `#4A8BFF` (4.6 on soft, 5.7 on #121316) | `#E8F1FF` / `#192740` |
| decision | `#AB8A46` eye-ring bronze h84 | `#A98844` | 3.1 / 5.8 | `#876720` (4.6 on soft, 4.8 on #F7F5F0) | `#AB8A46` (4.6 on soft, 5.7 on #121316) | `#FFEECF` / `#332506` |
| need | `#B26B9B` **ext** magenta h345 (not in photo) | `#C0609A` | 3.6 / 4.9 | `#A94B85` (4.5 on soft, 4.8 on #F7F5F0) | `#CD6CA6` (4.5 on soft, 5.6 on #121316) | `#FFE9F4` / `#391D2D` |
| change | `#636B60` green-grey neutral | `#636B60` | 5.1 / 3.5 | `#636B60` (4.9 on soft, 5.1 on #F7F5F0) | `#899186` (4.5 on soft, 5.7 on #121316) | `#EAF3E7` / `#232A21` |
| handoff | `#02D0FD` eye cyan h221 | `#009ABC` | 3.1 / 5.8 | `#007893` (4.5 on soft, 4.7 on #F7F5F0) | `#069CBE` (4.5 on soft, 5.8 on #121316) | `#DBF6FF` / `#002D39` |
| redesign | `#8E77BF` **ext** violet h300 (not in photo) | `#9171CF` | 3.6 / 5.0 | `#7B5AB6` (4.6 on soft, 4.8 on #F7F5F0) | `#9C7CDB` (4.5 on soft, 5.6 on #121316) | `#F2EDFF` / `#2B223D` |
| doc | `#4AC3A2` tail teal h172 | `#16A081` | 3.1 / 5.8 | `#007D64` (4.6 on soft, 4.7 on #F7F5F0) | `#1AA282` (4.5 on soft, 5.8 on #121316) | `#D3FBED` / `#042F25` |
| release | `#A1A75A` tail lime-olive h113, chroma raised, hue 120 | `#829539` | 3.1 / 5.8 | `#647510` (4.5 on soft, 4.7 on #F7F5F0) | `#83973B` (4.5 on soft, 5.7 on #121316) | `#ECF5D4` / `#252B0C` |
| success | `#65A55D` tail green h142, deepened | `#308639` | 4.3 / 4.2 | `#277E32` (4.5 on soft, 4.7 on #F7F5F0) | `#4EA254` (4.6 on soft, 5.9 on #121316) | `#DEF9DE` / `#172E18` |
| warning | `#A97250` copper barb h53, chroma raised | `#B86A35` | 3.8 / 4.7 | `#A45821` (4.6 on soft, 4.8 on #F7F5F0) | `#C97945` (4.5 on soft, 5.6 on #121316) | `#FFECE1` / `#3B200F` |
| danger | `#A35C47` rust h37, chroma raised | `#B94839` | 4.8 / 3.7 | `#B94839` (4.5 on soft, 4.8 on #F7F5F0) | `#DF6A59` (4.5 on soft, 5.6 on #121316) | `#FFEBE7` / `#3D1E19` |

Type-dot separation: closest decision–release ΔE_ok 0.071; next handoff–doc 0.097; median 0.186.
Closest status↔type: warning–decision 0.075; success–doc 0.103.

### C. Mandarin Ink (mandarinfish) - bold editorial

| token | light | dark |
|---|---|---|
| bg | `#F9F4E9` | `#0F0C07` |
| surface | `#FFFDF9` | `#19160F` |
| border | `#D6D1C3` | `#312D25` |
| text | `#14110D` | `#F1EEE6` |
| muted | `#605A4E` | `#ACA79A` |
| text contrast | 17.2:1 | 16.8:1 |
| muted contrast | 6.2:1 | 8.1:1 |
| primary (fill) | `#0037BF` + white text 9.1:1 | `#679CFF` + `#060D1A` text 7.2:1 |

| slot | sampled | dot / stripe (both themes) | CR dot on light bg / dark bg | badge text light (on soft) | badge text dark (on soft) | soft light / soft dark |
|---|---|---|---|---|---|---|
| task | `#0037BF` electric blue h263 | `#1C56DE` | 5.6 / 3.2 | `#1C56DE` (5.3 on soft, 5.6 on #F7F5F0) | `#5289FF` (4.5 on soft, 5.6 on #121316) | `#E9F0FF` / `#1B2740` |
| decision | `#CA9D46` yellow line h82 | `#B1852B` | 3.1 / 5.8 | `#8F6600` (4.5 on soft, 4.7 on #F7F5F0) | `#B3872D` (4.5 on soft, 5.7 on #121316) | `#FFEED1` / `#342506` |
| need | `#AB5379` pink soft coral behind fish h355 | `#AB5379` | 4.5 / 3.9 | `#A64F75` (4.6 on soft, 4.8 on #F7F5F0) | `#CC7197` (4.6 on soft, 5.6 on #121316) | `#FFEAF1` / `#3B1D29` |
| change | `#676355` olive neutral | `#676355` | 5.5 / 3.2 | `#676355` (5.3 on soft, 5.5 on #F7F5F0) | `#938F80` (4.6 on soft, 5.7 on #121316) | `#F5F0E0` / `#2B281B` |
| handoff | `#11C3ED` cyan line h218 | `#0099BB` | 3.1 / 5.8 | `#007792` (4.6 on soft, 4.8 on #F7F5F0) | `#0C9CBE` (4.5 on soft, 5.8 on #121316) | `#DBF6FF` / `#012D39` |
| redesign | `#2C2F80` indigo h278, lifted + nudged | `#7658CB` | 4.8 / 3.7 | `#7658CB` (4.6 on soft, 4.8 on #F7F5F0) | `#967AF0` (4.5 on soft, 5.6 on #121316) | `#F0EEFF` / `#28233E` |
| doc | `#009B8B` **ext** teal h172 (not in photo) | `#249B7E` | 3.2 / 5.6 | `#007E64` (4.5 on soft, 4.6 on #F7F5F0) | `#2DA184` (4.5 on soft, 5.8 on #121316) | `#D3FBED` / `#042F25` |
| release | `#41990E` green line h138 | `#41990E` | 3.3 / 5.4 | `#327E00` (4.5 on soft, 4.7 on #F7F5F0) | `#4BA21F` (4.5 on soft, 5.7 on #121316) | `#E2F8DB` / `#1B2D14` |
| success | `#587231` olive-green h128, chroma raised | `#1B7C3D` | 4.8 / 3.7 | `#1B7C3D` (4.7 on soft, 4.8 on #F7F5F0) | `#47A160` (4.6 on soft, 5.8 on #121316) | `#DCF9E1` / `#132E1A` |
| warning | `#AE5F28` orange body h52 | `#AE5F28` | 4.3 / 4.2 | `#A6581F` (4.5 on soft, 4.8 on #F7F5F0) | `#CA7943` (4.5 on soft, 5.6 on #121316) | `#FFECE1` / `#3B200F` |
| danger | `#8F393E` fin red h19 | `#B03441` | 5.6 / 3.2 | `#B03441` (5.4 on soft, 5.6 on #F7F5F0) | `#E4646C` (4.6 on soft, 5.6 on #121316) | `#FFEBEA` / `#3D1D1E` |

Type-dot separation: closest handoff–doc ΔE_ok 0.095; next doc–release 0.110; median 0.198.
Closest status↔type: danger–need 0.084; warning–decision 0.097.


How they fit the current plan (`08-ux-and-design.md` §3.1):
- The slot hues stay close to today's token hues: task 255, decision 60, need 345, handoff 205, redesign 300, doc 170, release 145.
- So choosing a creature mostly changes four things: the neutral tint, the primary, the exact chroma, and the lightness of dot vs text values.
- The rule "type colours only on dot, badge, stripe" can stay. The creature brings vividness through higher chroma dots and stripes, the data-viz (heatmap, rings, sparklines) and one brand colour. It does not need tinted pages.

Which look for which choice:
- **(a) dark-first → Night Peacock.** Its primary is the luminous eye cyan `#02D0FD` with near-black text (10.4:1). In light mode the primary drops to `#006F83`, which feels serious and close to Goteav's teal. Trade-off: need and redesign are extended (magenta and violet are not in the photo), and the primary shares the handoff family.
- **(b) light-first → Reef & Sand.** Sand paper `#F9F6ED`, Red Sea blue primary `#0951DE` (6.5:1 with white text), and coral pink, lagoon teal, ochre, algae green, deep-water violet. Trade-off: the primary shares the task family (blue). That is fine because the primary is a filled button and task is a dot.
- **(c) bold editorial → Mandarin Ink.** Ink-blue `#0037BF` on cream `#F9F4E9` (9.1:1), black text (17:1), strong orange and gold. Use big display numbers, thick 4 px stripes and flat tiles. Trade-off: louder, so it needs strict restraint on chroma in rows.

---

## 4. Multi-colour UI that stays readable

### Patterns seen in products (with evidence)
1. **Colour only for identity, neutral chrome.**
   - Linear's redesign returned to "a more neutral and timeless appearance… by limiting how much chrome (blue in our case) was used in the calculations applied to our color system" ([Linear](https://linear.app/now/how-we-redesigned-the-linear-ui); shot `shots/ref-linear-redesign-blog-d.png`).
   - Things puts colour only on list icons; Plane only on state glyphs and label dots.
2. **Perceptual colour space, equal visual weight.**
   - Stripe's goals were "Predictable accessibility" and "Consistent visual weight: At each level, no single color appears to take priority over another".
   - They warn that in HSL "the blues appear especially dark and the yellows and greens appear especially light" ([Stripe](https://stripe.com/blog/accessible-color-systems); shot `shots/ref-stripe-accessible-color-d.png`).
   - Linear moved its themes to LCH and now defines a theme from three inputs, "base color, accent color, and contrast", with a contrast input for "super high-contrast themes".
   - Hub should keep oklch tokens (doc 08 already does) and generate each type's dot, text and soft values by moving L only, as section 2 does.
3. **Single-hue ramps for intensity.** GitHub's calendar uses 5 steps of one green (`#EFF2F5…#116329`) plus a Less/More legend. Team activity should use one hue (the primary), never the 8 type colours.
4. **One hue per metric when there are only 2–3 metrics.** Apple rings: three hues, each meaning one goal. This works because there are only three.
5. **Named colour families.** Duolingo names brand colours after animals. Notion offers 10 named colours, each with a text and a background variant **(general knowledge, unverified here)**. The creature naming (`--reef-lagoon`, `--peacock-eye`) gives designers and agents a shared language.
6. **Soft tint plus a strong edge.**
   - A badge uses a ~12 % tint background with dark text of the same hue. A 3 px stripe uses the full dot colour.
   - This keeps vivid colour small in area and high in saturation. Doc 08 already specifies it.
   - The tables above give the checked soft and text pairs.
7. **Name the trend in words.** Sentry writes "Escalating" under the sparkline. Never use colour alone (ui-ux-pro-max UX rule).

### Anti-patterns to avoid
- **Rainbow rows**: tinting every row in the timeline by its type. With 8 types, the page turns into confetti and no colour means anything. Allow tint only where the point is triage, the Awaiting me stack, and only with owner OK on P2.
- **Bright creature colours as text on light**: peacock eye cyan `#02D0FD` is 1.7:1 on `#F7F5F0`, lagoon `#13B1FB` 2.2:1, mandarin gold `#CA9D46` 2.3:1. Always use the adjusted text values.
- **Status and type in the same family without an icon**: decision gold vs warning orange is ΔE 0.07–0.10 in all three palettes. Warning must always carry the clock icon and words ("overdue 3 h").
- **Glowing dark tints**: dark soft tints above chroma 0.05 vibrate on near-black. Keep them at L ≈ 0.27, C ≤ 0.05 (as computed). Lower to C 0.035 if they look neon in the build.
- **Imitating iridescence**: gradients or shimmer that mimic feathers or scales make a work tool look like a toy. Take the hues, not the textures. P2 bans gradients; the only exception worth testing is a thin 2 px gradient line under the agent narrative header, made of three type hues.
- **Rings or gauges without a target**: ui-ux-pro-max says gauges only "when a defined target exists". Team activity has no target, so use a heatmap or bars, not rings.
- **A heatmap without numbers**: it needs a numeric legend and a focus or tooltip with the exact value (ui-ux-pro-max chart rule).
- **Streaks and leaderboards for a 6–12 person team**: Duolingo-style gamification in a work tool invites gaming the metric. Show team totals and "cards closed this week" without ranking.
- **Lime or yellow as small text**: lime release `#829539` needs `#647510` to pass on light. Lime dots on dark are fine.

---

## 5. RTL / Arabic notes

### Arabic-first dashboards seen
| product | shot | what it shows |
|---|---|---|
| **Salla** ([salla.com](https://salla.com/), `lang="ar-SA" dir="rtl"`) | `shots/ref-ar-salla-d.png`, `-m.png` | A dashboard mock in RTL. Top bar with the logo at the right and the nav flowing left. Summary card "ملخص مبيعات يونيو" holds icon tiles: the icon sits right of the label, the number below it, and the currency after the number ("248,339 ر.س"). A goal bar "هدف الشهر 86%" sits under the tiles. In the orders list the avatar is at the right (start), the amount and relative time "منذ 23 دقيقة" at the left (end), and status is a dot plus text ("بانتظار المراجعة"). Headline font: "Ping AR + LT", a bilingual family. |
| **Qoyod** ([qoyod.com](https://www.qoyod.com/), `ar-SA rtl`) | `shots/ref-ar-qoyod-d.png`, `-m.png` | An accounting app mock: sidebar on the right (المتابعة، المبيعات), breadcrumb flowing right to left, status pill "متصل" with a dot, and a **score ring "10/10 فحص قبل الإرسال"** with Latin numerals inside. Font: LamaSans. Evidence that a ring plus numerals works in RTL. |
| **Foodics** ([foodics.com/ar](https://www.foodics.com/ar/), `ar rtl`) | `shots/ref-ar-foodics-d.png`, `-m.png` | Computed body and h1 font: **IBM Plex Sans Arabic**. Production proof for Hub's current font choice at hero size (bold) and in the nav (regular). The phone-number strip mixes Arabic labels with Latin digits cleanly. |

(Earlier TradingView Arabic evidence: `F:/Goteav/redesign/dashboard/finance-currencies/research/references.md` #2. Tables mirror fully. A trailing sign "0.12%-" reads awkwardly, so isolate numbers and signs.)

### Mirroring rules for Today
- **Stripes and edges**: put the type stripe on `border-inline-start`. It lands on the right edge in Arabic and the left in English. The same applies to the overdue edge and the "you were here" marker.
- **Time axes (heatmap, sparklines, 72 h runway)**: mirror them, so "now" is always at the inline end: left in RTL, right in LTR. This matches how the eye ends a line. Keep the numerals LTR inside `<bdi>`. **(Recommendation, not verified with users; test with 2 Arabic-first members.)**
- **Percentages and units**: the specimen shows "%48" when a percentage sits in an RTL run (`shots/type-arabic-specimen-d.png`, every card). Wrap value + unit in `<bdi dir="ltr">48%</bdi>`. Doc 08 P5 already requires LTR isolates for keys and code; extend the rule to "number + unit".
- **Rings**: progress should run clockwise in LTR and counter-clockwise in RTL (`scale(-1,1)`). The number in the centre stays LTR.
- **Icons with direction**: arrows, "open" chevrons and the send icon flip. Clock, check and the brand mark do not.

### Arabic typography pairing
Rendered at the same CSS sizes (26 / 14 / 12 px) in `shots/type-arabic-specimen-d.png`. Font facts are from the Google Fonts metadata (`fonts.google.com/metadata/fonts`).

| font | facts | look at UI sizes | role |
|---|---|---|---|
| **IBM Plex Sans Arabic** | Weights 100–700, static (no variable axis). Designers: Mike Abbink, Bold Monday, Khajag Apelian, Wael Morcos. | Compact; looks smaller than Kufi or Readex at the same px; very clean. Latin glyphs match IBM Plex Sans. | **Body + UI (keep as default).** Headings at 600/700. |
| **Noto Kufi Arabic** | Variable wght 100–900 (Google) | Geometric, open, large apparent size; strong digits. | **Headings, counters, section titles.** Too loud for long body. |
| **Noto Naskh Arabic** | Variable wght 400–700, serif category | Calligraphic. The most "written" feel; small x-height, weak at 12 px meta. | **Agent narrative / long-form only** (16 px, 1.8 line-height). Gives the "morning letter" feel. |
| **Readex Pro** | Variable wght 160–700 + HEXP axis. Designers include Bonnie Shaver-Troup, Thomas Jockin and Nadine Chahine (Shaver-Troup and Jockin made Lexend, a readability-focused font: general knowledge). | Wide, very readable small text, friendly digits. | **Alternative body**, or the whole UI for a friendlier look. Pairs with Lexend Latin. |
| **Alexandria** | Variable wght 100–900; Mohamed Gaber, Julieta Ulanovsky | Wide geometric, the boldest presence. | **Display numbers / page title** in the editorial (Mandarin) look. |
| **Tajawal** | Static 200–900; Boutros Fonts | Light and small at the same px; fine for labels, weak for dense body. | Not recommended as the primary body. |
| (bonus) Vazirmatn, Noto Sans Arabic | Variable 100–900 | Neutral, sturdy | Fallbacks |

Recommended pairings:
1. **Calm (default, any palette)**: IBM Plex Sans Arabic 400/500/600/700 for everything, Inter for Latin, JetBrains Mono for keys. Keep the `--leading-boost`. Consider Arabic body at 15 px, because Plex Arabic reads about one step smaller than Kufi or Readex.
2. **Editorial (Mandarin Ink)**: Alexandria 700 for page titles and display counters, IBM Plex Sans Arabic for UI text, Noto Naskh Arabic 16 / 1.8 for the agent narrative.
3. **Friendly-readable (Reef & Sand option)**: Readex Pro for UI and headings (variable, a single file), Noto Naskh only for the narrative.

---

## 6. Bold ideas for this page (10, concrete)
★ = not an industry default; worth a version in the lab.

1. ★ **Awaiting me as a stack of type-tinted cards** **[needs owner OK: P2]**
   - Each item is a card: soft type tint background (for example decision `#FFEECF` / dark `#332506` in Reef), a 3 px stripe on `border-inline-start`, key + title, and one inline action button (Decide / Deliver / Ack).
   - Overdue cards swap the stripe for danger and add "overdue 3 h" in words.
   - Why for Goteav: the job is triage. Colour by type lets a member see "3 decisions, 1 need" before reading a word. The tint lives only in this block, and the rest of the page stays neutral.
2. ★ **"Cleared today" ring in the header**
   - One small ring per awaiting group (decisions / needs / handoffs / reviews), drawn in the type dot colours, closing as items leave Awaiting me today. The target is 0 left.
   - Counter-clockwise in RTL; the number stays LTR in the centre.
   - Why: Apple-ring completion feedback with a real target (ui-ux-pro-max allows gauges only with one), and no streaks.
3. **Team activity as a contribution-style heatmap** (owner block)
   - Rows = members (avatar colour dot), columns = the last 14 days (phone: 7), cell = sessions + commits + cards closed. A 5-step ramp of the palette primary, a numeric legend, and the exact value on focus or tooltip.
   - Why: the GitHub calendar is instantly understood by developers. One hue keeps it calm, and 14 columns × 12 members = 168 cells (≥ 20 cells, so a heatmap is allowed).
4. ★ **Living status dots for capture-source health** (GitHub repos, OpenAPI, lab, docs)
   - Healthy: a slow 4 s "breathing" opacity, static under reduced motion. Lag over threshold: amber plus "12 min behind". Failing: danger plus the error count and "last success 09:12".
   - The dot is always followed by text.
   - Why: owners need to see "is the pipeline alive?" at a glance. A breathing dot says "live" the way Sentry's "Ongoing" does, without a chart.
5. ★ **The agent narrative as a "morning letter"**
   - Noto Naskh Arabic at 16 / 1.8 on the surface, the date as a dateline, signed "كتبه وكيلك 08:41".
   - Inline `CardChip`s for every key mentioned. Collapsed to 3 lines after the first read.
   - A "what changed since yesterday's letter" toggle shows Superhuman-style ~~before~~ → after diffs.
   - Why: the narrative is the only prose on the page. A distinct typographic voice marks it as written by a machine, which supports principle P4.
6. **Two lanes: "Needs me" (start side) vs "What happened" (end side)**
   - Linear Priority/Other plus Basecamp's rail. On desktop the start lane (right in RTL) holds Awaiting me, Deadlines and Ready; the end lane holds Since last visit and Sessions without summary. On phone, a single column in the plan's order.
   - Why: the plan already lists these two kinds. Lanes keep "act" and "read" apart, so the eye never mixes them.
7. ★ **Tide line in "Since your last visit"**
   - A visible marker "you were here, yesterday 18:20" (`border-inline-start`, primary colour). Events are grouped per repo with tiny commit-count bars. Contract handoffs are pinned above the line, shown as before→after diffs of the changed endpoints.
   - Why: lastSeenAt is a first-class concept in the plan (§4). Making it visible explains why the list is short or long.
8. **72-hour deadline runway**
   - A horizontal strip from now to +72 h (mirrored in RTL). Items are pins coloured by type dot. Overdue items stack before "now" on a danger soft tint, and escalated pins get a ring outline.
   - Phone falls back to a sorted list with "in 3 h" labels.
   - Why: deadlines in the plan are exactly "next 72 h + overdue". A runway shows clustering, for example three decisions due at 15:00, that a list hides.
9. **Counters band as small tiles with a 7-day sparkline and a word**
   - 6 tiles (inbox unread, decisions open/overdue, needs open, handoffs pending, tasks ready, redesigns in review). Each tile: display number (`text-display`, tabular), the type dot, and a 7-point sparkline with a word ("rising", "steady"), as Sentry does.
   - Overdue shows a danger dot plus the count in words.
   - Why: it turns counters into trends without a chart page. A minimum of 7 points satisfies the ≥ 4 points sparkline rule.
10. **"Bubble up to tomorrow" and "Close the day"**
    - Any awaiting row can be bubbled to tomorrow's Today with a reason, as in Basecamp 5. The item returns at `digest.morning_time`.
    - An evening "Close the day" button writes a 3-line shutdown card ("cleared 5, deferred 2, blocked on GTV-240") that the agent reads into the next morning letter, like Sunsama's daily shutdown.
    - Why: it closes the loop between the human day and the agent's narrative, which is the product's AI-agent angle.

Most worth testing as non-defaults: **#1 tinted awaiting stack**, **#4 living source dots**, **#5 morning letter**, **#7 tide line**. Each has a direct reason in Hub's data model: routing to roles, capture adapters, `hub.save_brief`, `lastSeenAt`.

---

## 7. Sources

Layout and product pages (all opened 2026-11-03):
- Linear Inbox: https://linear.app/docs/inbox
- Linear My issues: https://linear.app/docs/my-issues
- Linear Pulse: https://linear.app/docs/pulse
- Linear redesign (LCH, chrome): https://linear.app/now/how-we-redesigned-the-linear-ui
- GitHub dashboard quickstart: https://docs.github.com/en/account-and-profile/get-started/personal-dashboard-quickstart
- GitHub personal dashboard (feeds): https://docs.github.com/en/enterprise-server@3.14/account-and-profile/setting-up-and-managing-your-personal-account-on-github/managing-user-account-settings/about-your-personal-dashboard
- GitHub contributions: https://docs.github.com/en/account-and-profile/concepts/contributions-on-your-profile
- GitHub profile with calendar: https://github.com/torvalds
- Stripe Dashboard basics: https://docs.stripe.com/dashboard/basics
- Stripe accessible colour systems: https://stripe.com/blog/accessible-color-systems
- Sentry Issues: https://docs.sentry.io/product/issues/
- Sentry escalating issues changelog: https://sentry.io/changelog/2023-9-21-find-trending-problems-faster-with-escalating-issues
- Sentry docs mirror (tabs and priority sort): https://qubitpi.github.io/sentry-docs/product/issues
- Things features: https://culturedcode.com/things/features/
- Things home: https://culturedcode.com/things/
- Sunsama: https://www.sunsama.com/
- Notion sidebar and Home: https://www.notion.com/help/navigate-with-the-sidebar
- Notion Home (older article): https://www.notion.com/help/home-and-my-tasks
- Basecamp 5: https://basecamp.com/5
- Basecamp notifications help: https://3.basecamp-help.com/article/86-how-notifications-work
- Plane: https://plane.so/
- Plane v0.25.0 release notes: https://newreleases.io/project/github/makeplane/plane/release/v0.25.0
- Plane v2.5.0 changelog: https://plane.so/changelog/release-v2-5-0-new-widgets-mcp-connectors-plane-ai-for-self-hosted
- Apple Close Your Rings: https://www.apple.com/watch/close-your-rings/
- Duolingo: https://www.duolingo.com/
- Duolingo colour page: https://design.duolingo.com/identity/color (Cardinal, Bee, Fox seen in the search-indexed text; the page redirected to the blog when opened; Feather Green, Macaw, Beetle from mirrors such as https://www.shadcn.io/design/duolingo, unverified)
- Superhuman: https://superhuman.com/
- Akiflow features (via search, no UI seen): https://akiflow.com/features
- Height shutdown: https://alternativeto.net/news/2025/3/height-project-management-tool-to-shut-down-by-september-2025/

RTL:
- Salla: https://salla.com/
- Qoyod: https://www.qoyod.com/
- Foodics Arabic: https://www.foodics.com/ar/
- Google Fonts metadata: https://fonts.google.com/metadata/fonts

Creature photos (Wikimedia Commons; licences as stated on each file page). The images are not stored in the repo, only cited.
- Peacock male: https://commons.wikimedia.org/wiki/File:Peacock_male_(Pavo_cristatus).jpg (Memurubu, CC BY-SA 4.0)
- Peacock's tail: https://commons.wikimedia.org/wiki/File:Peacock%27s_tail_(4525489101).jpg (benjgibbs, CC BY 2.0)
- Mandarinfish: https://commons.wikimedia.org/wiki/File:Synchiropus_splendidus_2_Luc_Viatour.jpg (Luc Viatour, CC BY-SA 3.0)
- Mandarinfish pigment fact: https://en.wikipedia.org/wiki/Synchiropus_splendidus
- Panther chameleon, Ambilobe: https://commons.wikimedia.org/wiki/File:Ambilobe_panther_chameleon.jpg (Daniel Schwen, CC BY-SA 4.0)
- Panther chameleon, Nosy Be: https://commons.wikimedia.org/wiki/File:Panther_chameleon_(Furcifer_pardalis)_male_Nosy_Be.jpg (Charles J. Sharp, CC BY-SA 4.0)
- Rainbow lorikeet: https://commons.wikimedia.org/wiki/File:Rainbow_lorikeet_(Trichoglossus_moluccanus_moluccanus)_Sydney.jpg (Charles J. Sharp, CC BY-SA 4.0)
- Chromodoris annae: https://commons.wikimedia.org/wiki/File:Babosa_de_mar_(Chromodoris_annae),_Anilao,_Filipinas,_2023-08-22,_DD_53.jpg (Diego Delso, CC BY-SA 4.0)
- Anna's hummingbird: https://commons.wikimedia.org/wiki/File:Anna%27s_hummingbird_(Calypte_anna)_male_in_flight_Campbell_River.jpg (Charles J. Sharp, CC BY-SA 4.0)
- Violet sabrewing: https://commons.wikimedia.org/wiki/File:Violet_sabrewing_(Campylopterus_hemileucurus_mellitus)_male_in_flight.jpg (Charles J. Sharp, CC BY-SA 4.0)
- Morpho menelaus: https://commons.wikimedia.org/wiki/File:Morpho_menelaus_huebneri_MHNT_Male_Dos.jpg (Didier Descouens, CC BY-SA 4.0)
- Queen parrotfish: https://commons.wikimedia.org/wiki/File:Queen_parrotfish_Scarus_vetula_terminal_phase_(3471718081).jpg (Paul Asman and Jill Lenoble, CC BY 2.0)
- Rainbow eucalyptus bark: https://commons.wikimedia.org/wiki/File:Starr-130214-1575-Eucalyptus_deglupta-bark-Waihee-Maui_(25112573891).jpg (Forest and Kim Starr, CC BY 3.0 US)
- Coral reef, Palmyra Atoll: https://commons.wikimedia.org/wiki/File:Colorful_underwater_landscape_of_a_coral_reef.jpg (Jim E Maragos, USFWS, public domain)
- Coral reef, Red Sea: https://commons.wikimedia.org/wiki/File:%D9%83%D9%86%D8%B2_%D8%A7%D9%84%D8%AD%D9%8A%D8%AF_%D8%A7%D9%84%D9%85%D8%B1%D8%AC%D8%A7%D9%86%D9%8A_._%D8%A8%D8%A7%D9%84%D8%A8%D8%AD%D8%B1_%D8%A7%D9%84%D8%A3%D8%AD%D9%85%D8%B1.jpg (Pretty Dodo, CC BY-SA 4.0)
- Gouldian finch: https://commons.wikimedia.org/wiki/File:Erythrura_gouldiae_-Artis_Zoo_-Netherlands_-male-8a.jpg (Arjan Haverkamp, CC BY 2.0)

Licence note: hex values sampled from photos are facts, not copyrightable expression. If a future version shows the photos themselves (for example in a design note), credit the author and licence as listed. For CC BY-SA images, any derivative image must keep the same licence.
