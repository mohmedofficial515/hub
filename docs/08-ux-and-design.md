# 08 — UX and design system

The visual and interaction contract for `apps/web`. Every page in `09-pages.md` is built from the
tokens, components and rules here. Where this document and shadcn defaults disagree, this document
wins. Wireframes in both documents are drawn left-to-right; the Arabic UI is the exact mirror.

## 1. Design principles

| # | Principle | Concrete rule |
| --- | --- | --- |
| P1 | **The timeline is the product.** Everything else is a filtered view of it. | Every list row in Hub is a card or an event, rendered by the same `TimelineItem`/`CardChip` components. No page invents its own row design. |
| P2 | **Calm, dense, readable.** The team reads Hub many times a day; it must look like a well-set document, not a dashboard of widgets. | Default density `comfortable` (row ≥ 44 px); one accent colour (`primary`) for actions; type colours are used only on the type dot, badge and the card sheet header stripe — never on whole rows or backgrounds. No gradients, no drop shadows deeper than `shadow-sm`, no decorative illustration. |
| P3 | **What waits for me comes first.** Cards routed to my roles always outrank everything else. | "Today" and "Inbox" open on the awaiting-me block; every list has an "awaiting me" quick filter; every card routed to one of my roles shows a `RoleBadge` with a filled dot. |
| P4 | **Machines write, people decide.** The UI makes clear who wrote what. | Author chips show `user`, `agent (name)` or `system (adapter)` with distinct icons; the actor's kind is recorded and shown, and never used to refuse (D27): an action depends on the member's roles only; no action in the UI is ever hidden because it is machine-created. |
| P5 | **Arabic is the first language, not a translation.** | Layout is designed RTL first; English is the mirror. Arabic digits are not used (Latin digits everywhere, per the Goteav sites). Card keys, paths, commands and code are always LTR isolates. |
| P6 | **Nothing disappears.** | Delete («حذف») is recoverable (D28): it hides a card everywhere, and the Deleted view («المحذوفات») restores it. There is no hard delete; redacted comments keep their slot ("redacted by owner"). |
| P7 | **Every action is reachable by keyboard and from the command palette.** | Every primary action has a shortcut listed in §12; `Ctrl/Cmd+K` finds every page, card and action. |

## 2. Information architecture

```
Sidebar (per workspace)                       Counters (badge on the item)
───────────────────────────                   ─────────────────────────────
Today                                         —
Inbox                                         unread count
───────────── Work ────────────
Planning                                      open ideas and plans (15 §4)
Timeline                                      new events since last visit (pill, not badge)
Tasks                                         tasks ready for my roles
Decisions                                     open decisions routed to my roles (red if overdue)
Needs                                         needs routed to my roles
Handoffs                                      pending handoffs to my roles (red if stale)
Redesign                                      versions in `review` (owner only)
Releases                                      —
───────────── Knowledge ───────
Docs                                          —
Ask                                           —
Onboarding                                    unfinished items (new members only; hides when done)
───────────── Workspace ───────
Members                                       pending invites (owner/pm)
Settings                                      sources with errors (owner/pm)
───────────────────────────
Workspace switcher · Locale · Theme · Me (profile, tokens, sign out)
```

- The sidebar is per project (D30: the UI says Project, «مشروع»; routes and code keep `workspace`); switching reloads counters. The URL always carries
  `/[locale]/[workspace]/…`.
- Counters are computed by `GET /api/v1/workspaces/{ws}/counters` (cached 30 s, invalidated by SSE).
- Top bar: breadcrumb (`Goteav › Decisions › GTV-231`), global search input (opens the palette),
  "new card" button (`+`), the "live" indicator (SSE connected / reconnecting), avatar.
- A `CardSheet` (drawer) opens over any page for `/cards/[key]`; the full-page route exists for deep
  links and phones.

## 3. Tokens (`apps/web/src/app/globals.css`)

Same mechanism as the Goteav dashboard: CSS variables on `:root` and `.dark`, exposed through
`@theme inline` so Tailwind utilities read tokens only. `eslint` rule `no-restricted-syntax` forbids
`bg-red-500`-style palette classes and literal sizes (`text-[13px]`), as in the dashboard.

### 3.1 Colour

Values are `oklch(L C H)`; hex approximations in comments are for designers. Each `*-foreground`
pair meets WCAG AA (≥ 4.5:1 for body text, ≥ 3:1 for large text and UI borders). The executor adds
`scripts/check-contrast.ts` that parses `globals.css` and fails CI if any listed pair drops below
the threshold.

```css
:root {
  --radius: 10px;

  --background:             oklch(0.985 0.004 95);   /* #faf9f6 warm paper */
  --foreground:             oklch(0.21  0.01  80);   /* #1f1e1a */
  --card:                   oklch(1 0 0);            /* #ffffff */
  --card-foreground:        var(--foreground);
  --popover:                oklch(1 0 0);
  --popover-foreground:     var(--foreground);
  --primary:                oklch(0.48  0.085 175);  /* #0f6b5c deep teal */
  --primary-foreground:     oklch(0.99  0 0);
  --primary-text:           oklch(0.40  0.085 175);  /* text-primary on light surfaces: 6.4:1 */
  --primary-hover:          oklch(0.43  0.085 175);
  --secondary:              oklch(0.955 0.006 95);   /* #f1efe9 */
  --secondary-foreground:   var(--foreground);
  --muted:                  oklch(0.955 0.006 95);
  --muted-foreground:       oklch(0.47  0.012 80);   /* #6a675f  5.9:1 on background */
  --accent:                 oklch(0.93  0.03  175);  /* soft teal for hover/selected rows */
  --accent-foreground:      oklch(0.30  0.07  175);
  --destructive:            oklch(0.55  0.19  27);   /* #c0392b */
  --destructive-foreground: oklch(0.99  0 0);
  --success:                oklch(0.55  0.14  150);  /* #1f8a4c */
  --success-foreground:     oklch(0.99  0 0);
  --warning:                oklch(0.72  0.15  75);   /* #d9962b fill/icon only */
  --warning-foreground:     oklch(0.21  0.02  75);
  --warning-strong:         oklch(0.52  0.13  70);   /* text on light: 5.1:1 */
  --info:                   oklch(0.55  0.13  245);
  --info-foreground:        oklch(0.99  0 0);
  --border:                 oklch(0.90  0.008 90);
  --input:                  var(--border);
  --ring:                   oklch(0.60  0.10  175);

  /* soft surfaces = the colour at ~12 % over the background; text on them uses *-soft-foreground */
  --success-soft:     oklch(0.95 0.04 150);  --success-soft-foreground:     oklch(0.36 0.11 150);
  --warning-soft:     oklch(0.96 0.05 80);   --warning-soft-foreground:     oklch(0.42 0.11 70);
  --info-soft:        oklch(0.95 0.03 245);  --info-soft-foreground:        oklch(0.38 0.11 245);
  --destructive-soft: oklch(0.95 0.04 27);   --destructive-soft-foreground: oklch(0.42 0.16 27);

  /* card types — dot / icon / badge. *-fg is the badge text on *-soft. */
  --type-task:        oklch(0.52 0.16 255);  --type-task-soft:     oklch(0.94 0.03 255);  --type-task-fg:     oklch(0.36 0.14 255);
  --type-decision:    oklch(0.58 0.15 60);   --type-decision-soft: oklch(0.95 0.05 70);   --type-decision-fg: oklch(0.40 0.13 55);
  --type-need:        oklch(0.55 0.18 345);  --type-need-soft:     oklch(0.95 0.04 345);  --type-need-fg:     oklch(0.40 0.16 345);
  --type-change:      oklch(0.50 0.02 260);  --type-change-soft:   oklch(0.94 0.01 260);  --type-change-fg:   oklch(0.36 0.02 260);
  --type-handoff:     oklch(0.58 0.12 205);  --type-handoff-soft:  oklch(0.94 0.03 205);  --type-handoff-fg:  oklch(0.38 0.10 205);
  --type-redesign:    oklch(0.55 0.18 300);  --type-redesign-soft: oklch(0.95 0.04 300);  --type-redesign-fg: oklch(0.40 0.16 300);
  --type-doc:         oklch(0.52 0.09 170);  --type-doc-soft:      oklch(0.94 0.03 170);  --type-doc-fg:      oklch(0.36 0.08 170);
  --type-release:     oklch(0.55 0.14 145);  --type-release-soft:  oklch(0.94 0.04 145);  --type-release-fg:  oklch(0.36 0.12 145);

  /* priority */
  --prio-p0: var(--destructive);  --prio-p1: oklch(0.58 0.15 45);  --prio-p2: var(--muted-foreground);  --prio-p3: oklch(0.70 0.01 80);

  /* 12 avatar colours (member.avatarColor = name) */
  --avatar-1: oklch(0.62 0.12 20);  --avatar-2: oklch(0.62 0.12 50); /* … --avatar-12: hue step 30 */
}

.dark {
  --background:             oklch(0.17  0.006 260);  /* #141518 */
  --foreground:             oklch(0.93  0.006 90);
  --card:                   oklch(0.21  0.006 260);
  --card-foreground:        var(--foreground);
  --popover:                oklch(0.23  0.006 260);
  --popover-foreground:     var(--foreground);
  --primary:                oklch(0.78  0.11  175);  /* #4fc2a8 */
  --primary-foreground:     oklch(0.17  0.03  175);
  --primary-text:           oklch(0.82  0.10  175);
  --primary-hover:          oklch(0.83  0.11  175);
  --secondary:              oklch(0.26  0.006 260);
  --secondary-foreground:   var(--foreground);
  --muted:                  oklch(0.26  0.006 260);
  --muted-foreground:       oklch(0.70  0.01  90);   /* 6.0:1 on background */
  --accent:                 oklch(0.28  0.03  175);
  --accent-foreground:      oklch(0.90  0.06  175);
  --destructive:            oklch(0.68  0.17  25);
  --destructive-foreground: oklch(0.15  0.03  25);
  --success:                oklch(0.75  0.15  150);
  --success-foreground:     oklch(0.17  0.04  150);
  --warning:                oklch(0.80  0.14  80);
  --warning-foreground:     oklch(0.18  0.03  80);
  --warning-strong:         oklch(0.84  0.13  80);
  --info:                   oklch(0.74  0.12  245);
  --info-foreground:        oklch(0.17  0.03  245);
  --border:                 oklch(0.30  0.006 260);
  --input:                  var(--border);
  --ring:                   oklch(0.70  0.10  175);

  --success-soft:     oklch(0.25 0.05 150);  --success-soft-foreground:     oklch(0.84 0.13 150);
  --warning-soft:     oklch(0.26 0.05 80);   --warning-soft-foreground:     oklch(0.86 0.12 80);
  --info-soft:        oklch(0.25 0.04 245);  --info-soft-foreground:        oklch(0.84 0.10 245);
  --destructive-soft: oklch(0.25 0.06 25);   --destructive-soft-foreground: oklch(0.85 0.12 25);

  --type-task:        oklch(0.74 0.13 255);  --type-task-soft:     oklch(0.26 0.05 255);  --type-task-fg:     oklch(0.85 0.10 255);
  --type-decision:    oklch(0.78 0.14 65);   --type-decision-soft: oklch(0.27 0.05 65);   --type-decision-fg: oklch(0.88 0.11 70);
  --type-need:        oklch(0.76 0.15 345);  --type-need-soft:     oklch(0.27 0.05 345);  --type-need-fg:     oklch(0.87 0.11 345);
  --type-change:      oklch(0.72 0.02 260);  --type-change-soft:   oklch(0.27 0.01 260);  --type-change-fg:   oklch(0.84 0.02 260);
  --type-handoff:     oklch(0.78 0.11 205);  --type-handoff-soft:  oklch(0.26 0.04 205);  --type-handoff-fg:  oklch(0.87 0.09 205);
  --type-redesign:    oklch(0.76 0.15 300);  --type-redesign-soft: oklch(0.27 0.05 300);  --type-redesign-fg: oklch(0.87 0.11 300);
  --type-doc:         oklch(0.76 0.10 170);  --type-doc-soft:      oklch(0.26 0.04 170);  --type-doc-fg:      oklch(0.86 0.09 170);
  --type-release:     oklch(0.76 0.14 145);  --type-release-soft:  oklch(0.26 0.05 145);  --type-release-fg:  oklch(0.87 0.11 145);

  --prio-p0: var(--destructive);  --prio-p1: oklch(0.78 0.14 50);  --prio-p2: var(--muted-foreground);  --prio-p3: oklch(0.55 0.01 90);
}
```

`@theme inline` maps every variable to `--color-*` (and `--text-color-primary: var(--primary-text)`,
`--color-warning-strong`, `--color-type-task`, `--color-type-task-soft`, `--color-type-task-fg`, …)
exactly like the dashboard's `globals.css`. Dark mode is class-based (`next-themes`, `class`
attribute on `<html>`); `@custom-variant dark (&:is(.dark *))`, `rtl`, `ltr` are declared.

Rules of use:

- Type colours: only on `TypeDot`, the type icon and `StatusBadge`/`TypeBadge` (soft background + fg text). Never as row
  background, and **never as a coloured side or top edge on any card, panel or sheet, in any form (D31)**: a card is one
  neutral surface with one uniform neutral border.
- `primary` is reserved for the one primary action per view and for links. Secondary buttons are
  `outline`; destructive actions (`reject`, `cancel`, `revoke`) use `destructive` outline and a
  confirmation.
- Status semantics: `success` = done/verified/merged/approved; `warning` = overdue/stale/no-summary;
  `destructive` = escalated/rejected/failed; `info` = informational system events.

### 3.2 Typography

```css
--font-sans-ar: "Cairo", "Segoe UI", Tahoma, sans-serif;
--font-sans-en: "Inter", "Segoe UI", system-ui, sans-serif;
--font-mono:    "JetBrains Mono", ui-monospace, Consolas, monospace;
```

`<html lang="ar" dir="rtl">` sets `font-family: var(--font-sans-ar)`; `lang="en"` sets
`var(--font-sans-en)`. Mixed content: Latin runs inside Arabic text inherit Cairo
(its Latin glyphs are acceptable); card keys, paths and code always use `--font-mono`. Fonts are
loaded with `next/font/google` (`Cairo` weights 400/500/600/700, the owner's choice in the approved design, D31; `Inter` 400/500/600,
`JetBrains_Mono` 400/500) and self-hosted by Next so the app works with the internet down.

Named sizes (Tailwind `--text-*` tokens; literal sizes forbidden):

| token | size / line-height | weight | use |
| --- | --- | --- | --- |
| `text-caption` | 12 / 16 | 400 | meta lines, timestamps, badge text (badges use 500) |
| `text-body-sm` | 13 / 18 | 400 | dense table cells, secondary descriptions |
| `text-body` | 14 / 21 | 400 | default UI text, card bodies |
| `text-body-lg` | 15 / 23 | 400 | doc viewer, decision options, long-form |
| `text-title-sm` | 16 / 22 | 600 | card titles in lists, section headers |
| `text-title` | 18 / 26 | 600 | sheet titles, page sub-sections |
| `text-headline` | 22 / 30 | 600 | page titles |
| `text-display` | 28 / 34 | 700 | counters on Today, release headings |

Arabic text uses `line-height` one step higher than Latin for the same token (the `[lang=ar]`
selector adds `--leading-boost: 0.1`); the type scale in `@theme` references `calc()` so no
component needs to know. Numerals: `font-variant-numeric: tabular-nums` on counters, keys, dates.

### 3.3 Spacing, radius, elevation

- Spacing scale: Tailwind default (4 px base). Page gutter 24 px desktop, 16 px phone. Section gap
  24 px. Row padding 12 px × 16 px. Card sheet padding 24 px.
- Radius: `--radius: 10px` → `rounded-sm 6`, `rounded-md 8`, `rounded-lg 10`, `rounded-xl 14`,
  `rounded-2xl 18`. Badges and chips `rounded-full`.
- Elevation: `shadow-sm` for cards on `background`; `shadow-md` for popovers/sheets; nothing else.
  Dark mode: shadows off, borders carry the separation.
- Borders: 1 px `border`; focus ring 2 px `ring` offset 2 px.

### 3.4 Motion

| interaction | duration / easing | reduced motion |
| --- | --- | --- |
| hover/press colour | 120 ms ease-out | same |
| sheet / drawer open | 220 ms `cubic-bezier(.2,.8,.2,1)` translate + fade | fade 120 ms only |
| dialog | 160 ms fade + scale 0.98→1 | fade only |
| new timeline rows ("new events" pill click) | rows fade in 160 ms, no slide | instant |
| status badge change | 200 ms colour cross-fade | instant |
| skeleton shimmer | 1.2 s linear loop | static block |

`prefers-reduced-motion: reduce` is honoured through `motion-safe:`/`motion-reduce:` variants;
`framer-motion` is used only for the sheet and list reordering (`layout` prop), never for decoration.

### 3.5 Iconography (lucide-react, 16 px in rows, 20 px in headers, stroke 1.75)

| thing | icon | thing | icon |
| --- | --- | --- | --- |
| task | `SquareCheck` | status done / verified / merged | `CircleCheck` |
| decision | `Scale` | status overdue / stale | `Clock` (warning) |
| need | `KeyRound` | status escalated / rejected / failed | `TriangleAlert` |
| change (commits) | `GitCommitHorizontal` | status in progress / claimed | `CirclePlay` |
| change (PR) | `GitPullRequest` | status pending / open / requested | `Circle` |
| change (session) | `Bot` | archived | `Archive` |
| handoff | `ArrowLeftRight` | role owner | `Crown` |
| redesign | `Palette` | role pm | `ClipboardList` |
| doc | `FileText` | role accountant | `Calculator` |
| release | `Rocket` | role backend | `Server` |
| actor user | `User` | role frontend | `MonitorSmartphone` |
| actor agent | `Bot` | role designer | `PenTool` |
| actor system | `Cpu` | role qa | `Bug` |
| watch | `Eye` / `EyeOff` | blocked | `Ban` |
| copy prompt / command | `Copy` → `Check` | open in GitHub / lab | `ExternalLink` |

Directional icons that **mirror in RTL** (wrap in `rtl:-scale-x-100`): `ArrowRight`, `ArrowLeft`,
`ChevronRight`, `ChevronLeft`, `ArrowLeftRight` (no), `CornerDownLeft` (reply), `LogOut`,
`PanelLeft`/`PanelRight` (swap), `Undo`/`Redo`. Never mirror: check marks, clocks, play, external
link, git icons, text-alignment icons.

## 4. RTL and bilingual rules

1. Only logical CSS: `ps-/pe-/ms-/me-/start-/end-/text-start/text-end/border-s/border-e`,
   `rounded-s-*`. ESLint `tailwindcss/no-physical-properties` (custom rule copied from the dashboard)
   fails on `pl-`, `ml-`, `left-`, `text-left`, etc.
2. Card keys (`GTV-123`), commit SHAs, branch names, file paths, URLs, commands, code blocks,
   emails: wrapped in `<bdi class="font-mono">` or `<code dir="ltr">`; `unicode-bidi: isolate` is set
   globally on `code, kbd, bdi, [data-ltr]`.
3. Numbers: Latin digits in both locales (`Intl.NumberFormat(locale, { numberingSystem: 'latn' })`).
   Dates: `date-fns` with `ar`/`enUS` locales, numeric parts Latin, e.g. `الثلاثاء 4 نوفمبر، 09:30`.
4. Mixed paragraphs (Arabic text containing an English identifier) render fine with isolation;
   do not add `dir="auto"` to list rows (it breaks alignment) — set `dir` on the page and isolate the
   foreign fragments.
5. The sidebar, sheets, chevrons and the timeline spine mirror. Keyboard shortcuts referring to
   arrows (`←`/`→`) are described as "back/forward" in copy, mapped per direction in code.
6. Text inputs for commands and paths are `dir="ltr"` with `text-start`; search inputs are
   `dir="auto"`.
7. Toasts and dialogs are positioned `end` (bottom-right in LTR, bottom-left in RTL).

## 5. Component inventory

All components live in `apps/web/src/components/*` and accept `className`; props are typed from
`@hub/contracts`. Sizes below are desktop; phone adjustments in §10.

### 5.1 Atoms

| Component | Spec |
| --- | --- |
| `TypeDot` | 8 px circle in `type-<t>`; `aria-hidden`; always paired with a visible label or `sr-only` text. |
| `TypeBadge` | pill: `TypeDot` + type label (i18n `cards.type.<t>`), `text-caption` 500, bg `type-<t>-soft`, text `type-<t>-fg`, height 20. |
| `StatusBadge` | pill, `text-caption` 500. Colour by semantic: done/verified/approved/merged/ported/released → `success-soft`; in_progress/claimed/in_review/acknowledged/deciding → `info-soft`; requested/pending/open/ready/backlog/draft/review/planned → `muted`; overdue/stale (derived) → `warning-soft`; escalated/rejected/dismissed/cancelled/withdrawn/failed → `destructive-soft`. Label i18n `cards.status.<type>.<status>`. Icon from §3.5 at 12 px. |
| `PriorityBadge` | `P0`–`P3` in `font-mono text-caption`, colour `prio-*`; P0 adds a filled dot; P2/P3 are muted and hidden in dense lists unless filtered. |
| `RoleBadge` | icon + role label; outline. Variant `routed` (filled dot before label) when the role is one of mine. Multiple roles → stacked up to 2 + `+n`. |
| `ActorChip` | avatar (initials on `avatar-<n>`, 20 px) + name; agent → `Bot` icon overlay bottom-end and suffix "(agent)"; system → `Cpu` icon, name = adapter (`github`, `oasdiff`, `lab`, `docs`). Tooltip shows kind + via. |
| `CardKey` | `<bdi>` mono `GTV-123`, copy on click (toast "Copied"), link to the card. |
| `CardChip` | inline reference used in bodies, links and inbox: `TypeDot` + `CardKey` + title (truncated 48 ch) + optional `StatusBadge`. Hover → popover with title, status, owner role, due. |
| `RelativeTime` | `منذ 5 دقائق` / `5 min ago`, `title` = absolute. Switches to absolute date after 7 days. |
| `Kbd` | `<kbd>` mono `text-caption`, muted bg. |
| `CopyButton` | icon button; `aria-label` from prop; success state 1.5 s. |
| `SecretFilterError` | inline alert used by every free-text form: "This text looks like it contains a secret (`<pattern name>`). Remove it and describe where the value is stored instead." |

### 5.2 Timeline

**`TimelineItem`** — one event (or a 30-minute collapse of events on one card). Layout:

```
 ●───  [TypeBadge] Title of the card (title-sm)              RoleBadge · PriorityBadge
  │    meta line: ActorChip · event verb · RelativeTime · repo/branch (mono)     (caption, muted)
  │    body excerpt (body, muted, 2 lines max, markdown stripped)               [+n events ▾]
  │    [inline actions]
```

Per-type renderer rules:

| type | bold | muted | inline actions (when routed to me / permitted) |
| --- | --- | --- | --- |
| task | title | specialty · effort · claimer | `Claim` (ready + my specialty role), `Copy prompt`, `Open` |
| decision | question (title) | decider role · due (warning if < 24 h) · "blocks n" | `Decide…` (decider role), `Open` |
| need | title | kind · responsible role · "blocks n" | `Deliver…` / `Verify`, `Open` |
| change (commits) | branch (mono) + "n commits" | author · files/+/- | expand commits list (events) |
| change (PR) | PR title | `#number` · state | `Open PR` (external) |
| change (session) | "Session: <changed first line>" | member · duration · `no summary` warning badge | expand remaining/handoffs |
| handoff | summary | from → to roles (arrow mirrors) · severity badge · pending age | `Acknowledge`, `Copy prompt`, `Open` |
| redesign | `app/page · version` (mono) + concept title | status · review score | `Open in lab`, `Compare`, `Approve…` (owner) |
| doc | path (mono) | kind · changed headings count | `Open` |
| release | version | included count | `Open` |

**`TimelineFilters`** — segmented chips row (roles, types), then popover filters (repo, module,
member, date range), "awaiting me" toggle; all in URL (`09-pages.md` §Timeline). **`DayDivider`**
sticky header "Today / Yesterday / Tuesday 4 Nov". **`NewEventsPill`** floating at top center:
"3 new events ↑" → prepends rows.

### 5.3 CardSheet

Drawer anchored to the **end** side (right in LTR, left in RTL), width 560 px (desktop), full
screen under 768 px. Opens on any card click; `Esc` closes; URL updates to `?card=GTV-123` (shallow)
so refresh keeps it; full page at `/cards/GTV-123` renders the same component inline.

```
 ┌──────────────────────────────────────────────────────────────────┐
 │ [TypeBadge] GTV-123   [StatusBadge] [PriorityBadge]     ⋯  ✕       │  header (sticky)
 │ Title (title, editable inline for creator/owner/pm)                │
 │ RoleBadge · ActorChip created · RelativeTime · repo/branch         │
 │ [Primary action]  [Secondary]  [Watch]  [Copy key]                 │  action bar (sticky)
 ├────────────────────────────────────────────────────────────────────┤
 │ Tabs: Details · Comments (n) · History (n)                         │
 │                                                                    │
 │ Details: body (markdown) → type section (§5.4) → Links (blocks /   │
 │ blocked by / relates, with add) → Attachments (redesign shots)     │
 │ Comments: list (ActorChip, time, markdown) + composer (markdown,   │
 │   @mention, GTV- autocomplete, secret filter) — Ctrl+Enter sends   │
 │ History: every event (kind, actor, via, data diff) newest first    │
 └────────────────────────────────────────────────────────────────────┘
```

Overflow menu `⋯`: Edit, Change priority, Change role, Set due, Add tag, Delete/Restore
(owner/pm), Copy link, Open full page.

### 5.4 Type sections inside CardSheet

| Component | Spec |
| --- | --- |
| `TaskSection` | Specialty, effort, acceptance checklist (read-only markdown checkboxes; ticking is a comment "✔ item" by the claimer), prompt block (mono, `CopyButton`, "Paste `/hub:next GTV-123` in Claude Code" hint), branch/PR, claimer. Actions: Claim/Unclaim, Start, Submit for review, Mark done, Cancel (with reason). |
| `DecisionSection` | question (body-lg), `DecisionOptionCard` list, decider role, due with countdown, reminders sent, escalation state, "Blocks" list, ADR block (status, path, PR link, "Draft with `/hub:adr GTV-123`" hint). Actions: Decide… (human + decider role), Withdraw (creator/owner/pm), Edit options (creator before decided). |
| `DecisionOptionCard` | bordered card: title (title-sm), two columns pros/cons (body-sm lists), cost line, "recommended" tag. Selected state after decision: `success` border + "Chosen" badge; others dim to 70 %. In the decide dialog each card becomes a radio. |
| `NeedSection` | `NeedStatusStepper` (requested → in progress → delivered → verified; cancelled as a side state), kind, responsible role, requester, location (mono text, shown after delivered), verification note, blocks list. Actions: Start, Deliver… (location text + optional note; `SecretFilterError`), Verify… (note), Cancel. |
| `HandoffSection` | from → to (RoleBadges with mirrored arrow), kind, severity, pending age (`warning` after `handoffs.stale_hours`), summary, `HandoffDiffList`, prompt block with `CopyButton`, source change card chip, applied task chip. Actions: Acknowledge, Apply… (optionally create/link task), Dismiss (reason). |
| `HandoffDiffList` | for `kind=contract`: grouped by `breaking` / `non-breaking`; each row `METHOD /path` (mono) + change text from oasdiff; schema changes listed separately; "View raw" expands JSON. For `component`: file list with repo links. |
| `RedesignSection` | header `app/page/version` (mono), concept title, base, status (mirrors lab), review score + 2-line summary + "Open review.md", touches-components list (mono chips), screenshots grid (click → lightbox), `Open in lab` (external, `/lab/#/<app>/<page>/<version>`), `Compare` → `RedesignCompare`. Actions (owner): Approve…, Reject… (note required), Request changes… (note required); Mark ported (porter/pm, ref required). Port task chip when created. |
| `RedesignCompare` | full-screen dialog: two iframes side by side (base/baseline vs version, or any two versions via selects), toolbar: device (390 / 768 / 1440 / fill), lang (ar/en), theme (light/dark), notes on/off; iframes load `/lab/frame-<app>.html#/<page>/<version>?w=…&lang=…&theme=…` (lab contract). Synchronised scroll toggle. |
| `DocSection` / `DocViewer` | path breadcrumb (mono, copy), kind badge, source repo + commit (short SHA, link), "Open in GitHub"; markdown rendered (headings with anchors, tables, code with copy, task lists read-only, Mermaid rendered client-side if present), heading outline rail on ≥ 1280 px; "Referenced by" list of cards linking the doc. |
| `ReleaseSection` | version, repo/tag, released date, included cards list (grouped by type), notes tabs (team / owner / accountant) with `CopyButton`, "Regenerate skeleton" (pm/owner). |

### 5.5 Inbox and palette

| Component | Spec |
| --- | --- |
| `InboxItem` | unread dot (`primary`), kind icon, title (body, 600 when unread), body line (muted), `CardChip`, `RelativeTime`; quick action button per `data.action` (`Decide`, `Acknowledge`, `Deliver`, `Claim`) opening the card sheet positioned on that action; "mark read" on open; grouped items show "+n more on this card". Swipe-to-archive on touch. |
| `CommandPalette` | `cmdk`; `Ctrl/Cmd+K` or `/` when no input focused. Groups: **Cards** (search `GET /search?scope=cards&q=`, debounce 150 ms, shows `CardChip`), **Pages** (static list), **Actions** (New task/decision/need/handoff, Toggle theme, Switch workspace, Switch language, Copy my MCP setup), **Recent** (last 10 opened cards, local). `GTV-123` exact key jumps immediately. |
| `KeyboardShortcutsDialog` | `?` opens; lists §12. |
| `Toast` (`sonner`) | bottom-end; success 3 s, error sticky until dismissed with "Retry" when the mutation can be retried; never for live timeline events (those use the pill). |

### 5.6 States

| state | rule |
| --- | --- |
| Loading | skeletons shaped like the final rows (same heights) for ≤ 3 s; after 3 s a muted line "Still loading…"; never spinners inside lists; buttons show an inline spinner and keep their width. |
| Empty | `EmptyState`: icon (type or page icon, muted), title (title-sm), one sentence, one primary action when the user can act (e.g. "New decision"), otherwise a hint ("Decisions appear here when a teammate or an agent opens one"). |
| Error | `ErrorState`: title "Couldn't load <thing>", the error code (mono) and a Retry button; the request id in a tooltip for support. 403 → "You don't have access to this" with the required role named. |
| Offline / SSE down | top bar indicator turns `warning` with "Reconnecting…"; lists stay interactive from cache; mutations queue is **not** implemented — buttons disable with tooltip "Offline". |
| No permission on an action | the button is rendered disabled with a tooltip naming the role. Permissions depend on the role only (D27). |

### 5.7 Forms

`react-hook-form` + `zodResolver` with schemas from `@hub/contracts`; inline errors under the field
(`text-caption destructive`), summary alert at the top only for server-side errors; Arabic/English
messages from `messages/<locale>.json` (`errors.*`), never raw Zod messages. Required fields marked
with a dot, not an asterisk. Long text fields are markdown with a small toolbar (bold, list, code,
link, `GTV-` reference) and a preview toggle. Every form that posts free text shows
`SecretFilterError` on `hub.security.secret_detected`. Submit with `Ctrl+Enter`; unsaved-changes
guard on sheets.

## 6. Accessibility checklist (CI: `axe-core` in Playwright on the five critical flows)

- Focus order follows visual order; sheets trap focus; closing returns focus to the opener.
- Live updates: the timeline list has `aria-live="polite"` only on the `NewEventsPill` text, not on
  the list (avoid chatter); inbox count badge `aria-label="3 unread"`.
- Every icon-only button has `aria-label`; every `TypeDot` is `aria-hidden` with adjacent text.
- Contrast ≥ 4.5:1 for all text pairs (checked by `scripts/check-contrast.ts`), ≥ 3:1 for borders of
  inputs and focus rings.
- Touch targets ≥ 44 × 44 px on phone (rows are 48 px min; inline action buttons grow to 40 px high
  with 44 px hit area).
- All actions reachable by keyboard; shortcuts never override browser/OS shortcuts; `?` shows them.
- `prefers-reduced-motion` honoured; `prefers-color-scheme` as default theme until the user chooses.
- Forms: labels bound with `htmlFor`, errors with `aria-describedby`, `aria-invalid`.
- Language: `lang` on `<html>` and on fragments in the other language (`<span lang="en">` for
  identifiers inside Arabic text is not required; `bdi` isolation is).

## 7. Responsive

| breakpoint | layout |
| --- | --- |
| ≥ 1280 (`xl`) | sidebar 248 px expanded · content max 1100 px · card sheet 560 px overlays |
| 1024–1279 (`lg`) | sidebar collapsed to icons (56 px) with tooltips · sheet 520 px |
| 768–1023 (`md`) | no sidebar; top bar hamburger opens a sheet with the nav · boards become horizontal scroll with snap · sheet full width |
| < 768 (phone) | phone-first pages (Today, Inbox, Decisions, Needs, card page) are tuned: single column, filters in a bottom sheet, primary action as a bottom bar button, rows 48 px, `CardSheet` is the full-page route. Timeline, Tasks, Handoffs, Redesign, Docs work but are not optimised; Settings, Members, Redesign compare show "best on a larger screen" banners but remain usable. |

## 8. Internationalisation

- `next-intl` with `messages/ar.json` and `messages/en.json`; namespaces: `common`, `nav`,
  `today`, `timeline`, `cards` (`type.*`, `status.<type>.*`, `priority.*`, `actions.*`),
  `decisions`, `needs`, `handoffs`, `tasks`, `redesign`, `docs`, `releases`, `inbox`, `ask`,
  `onboarding`, `members`, `settings`, `auth`, `errors`, `shortcuts`.
- ICU plurals for Arabic (`zero/one/two/few/many/other`): `"{count, plural, =0 {لا بطاقات} one {بطاقة واحدة} two {بطاقتان} few {# بطاقات} many {# بطاقة} other {# بطاقة}}"`.
- Never concatenate strings; use placeholders (`"{actor} قرّر {option}"`). Role, type and status
  labels are looked up by key, never hard-coded.
- Dates: `date-fns/format` with locale; relative times via `formatDistanceToNowStrict`; all stored
  UTC, displayed in the workspace timezone (not the browser's) with a tooltip showing both when they
  differ.
- English copy is written first in the catalog; Arabic is the shipped default; the executor keeps
  both files key-complete (CI check `scripts/check-i18n.ts`).

## 9. Performance budgets

- LCP ≤ 2.0 s on the LAN for Today and Timeline (SSR of the first 30 rows, streaming).
- Initial JS ≤ 250 kB gzip for the app shell; route chunks ≤ 120 kB; `RedesignCompare` and the
  markdown/Mermaid renderers are dynamic imports.
- Timeline and Inbox lists are virtualised (`@tanstack/react-virtual`) above 60 rows; pages are
  cursor-based (`limit=50`).
- Query cache: `staleTime` 30 s for lists, 5 min for docs; SSE invalidates by card id.
- Images (lab screenshots) are lazy with explicit `width/height` to avoid CLS; `next/image` with
  `unoptimized` for `/lab/` paths (served by Caddy).

## 10. Density and preferences

Per-member UI preferences (`zustand` + `localStorage`): density (`comfortable` 44 px rows /
`compact` 36 px), theme, sidebar collapsed, default timeline filters, last workspace. None of these
is synced to the server.

## 11. Copy tone

Short, factual, present tense. Arabic uses the neutral formal register used across the Goteav
dashboard (no dialect, no exclamation marks). Buttons are verbs ("قرّر", "استلم", "سلّم" for a Need's delivery only, since a Handoff is «إحالة» per D23, "احجز",
"وافق"). System events read as facts ("3 commits على feat/refunds"). Error messages say what to do
next.

## 12. Keyboard shortcuts (global unless noted)

| key | action |
| --- | --- |
| `Ctrl/Cmd+K`, `/` | command palette |
| `?` | shortcuts dialog |
| `g t` / `g i` / `g l` / `g d` / `g n` / `g h` / `g k` / `g r` | go to Today / Inbox / Timeline / Decisions / Needs / Handoffs / Tasks / Redesign |
| `n` then `t/d/n/h` | new task / decision / need / handoff |
| `j` / `k` | next / previous row (lists, timeline, inbox) |
| `Enter` / `o` | open focused row (sheet) |
| `Esc` | close sheet / dialog / clear search |
| `c` | claim (task row/sheet), `a` acknowledge (handoff), `e` mark read (inbox), `w` watch toggle |
| `Ctrl/Cmd+Enter` | submit form / send comment |
| `Ctrl/Cmd+Shift+C` | copy card key (sheet) · `Ctrl/Cmd+Shift+P` copy prompt (task/handoff) |
| `r` | refresh "new events" (timeline) |
| `[` / `]` | collapse / expand sidebar |
