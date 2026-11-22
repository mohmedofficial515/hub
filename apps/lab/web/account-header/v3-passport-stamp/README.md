---
version: v3-passport-stamp
title: Passport stamp (fix round 1)
status: approved # draft | review | approved | rejected | ported
base: v2-passport-stamp
created: 2026-11-21
tokens: override # tokens.css: develop's roles (light + .dark) + --ah-* / --pm-* component tokens
touches-components: [components/layout/header-top-bar.tsx, components/layout/mobile-header-menu.tsx, features/account/account-shell.tsx, features/account/account-hero.tsx, features/account/hero/travel-hero.tsx, features/account/hero/wallet-hero.tsx, features/account/hero/hero-waves.tsx, features/account/account-profile-card.tsx, features/account/account-menu.tsx, providers/auth-context.tsx, NEW components/shared/user-avatar (Postmark)]
ported:
decided-at: 2026-11-21T19:17:28.939Z
decided-by: Owner
decision-note: "موافقة المالك 2026-11-21. الترويسة بيضاء خارج صفحات الحساب، الفضي slate، الصورة دائرية."
---

# Passport stamp (fix round 1)

v3 keeps the v2 concept unchanged and fixes the ux-critic review (`../v2-passport-stamp/review/review.md`). v2 is in
`review` and is not edited. Owner decisions now final: D4 weights ≤ 700, D6 no 13 px, D7 flat navy account hero.

## Changes from v2
- **Header account menu is a disclosure** (`parts/site-header.tsx`): the button has `aria-expanded` + `aria-controls`,
  no `aria-haspopup="menu"` / `role="menu"`; the panel is a plain list of links. Opening moves focus to the first
  link; Escape closes and returns focus to the button; an outside click closes (and returns focus when it was inside);
  tabbing out closes it.
- **Site drawer is modal** (below xl): rendered in a portal, `#root` gets `inert`, the page cannot scroll
  (`overflow: hidden` on `<html>`), Tab and Shift+Tab cycle inside it, Escape closes and returns focus to the menu
  button. Titled "قائمة الموقع / Site menu". Sections like the baseline drawer: navigation (6 links, "soon" badges),
  services (hotels, packages, flights, eSIM; non-flight "soon"), popular destinations (the baseline's four names as
  text chips; the baseline's photos are hot-linked template demo images, so they are not carried over), my account
  (the six account links), and below 640 px language + currency + theme. The 64 px account row with sign-out closes it.
- **Breakpoint aligned at xl**: the account button and the inline nav show from 1280 px; below that the menu button
  (32 px stamp + menu icon) opens the drawer, so 1024–1279 px is no longer left without navigation. The menu button's
  name is "القائمة، {name}، مستوى {level}".
- **Theme toggle restored** in the header (from 640 px) and in the drawer (below 640 px), with a "switch to dark / light"
  name.
- **BLUE vs SILVER at 32 px**: BLUE is one 2 px line; SILVER two 1 px lines with a full 1 px gap (r 13.5 / 15.5). On the
  navy bar and in dark mode SILVER ink is neutral-400 (was neutral-300), further from BLUE's navy-200.
- **Badge no longer covers the micro-text at 128**: the text runs leave a 42° gap behind the badge (bottom-end, after
  the tilt), and at GOLD a second gap for the star; each run is sized to its arc.
- **GOLD 128 centred with its tail**: the tail is 4 waves (16 px overhang) and the side card pads the start side by the
  same amount, so stamp + tail read as one centred mark.
- **One translated nav label** ("التنقل الرئيسي / Main navigation"); the drawer's nav only exists while it is open
  and the header's inline nav is `display: none` below xl.
- **LevelMark keyline** is a 1 px `border`, not an inset box-shadow.

## Idea
The site header and the account hero become one flat navy surface, the cover of a passport, split only by a
hairline. The side card is the passport's data page: white (ink-900 in dark), thin lines, and on it the customer's
photo or monogram stamped inside a **Postmark** frame. The frame is the one bold element of the page; everything
around it is quiet. The frame says the level twice, by colour **and** by structure, so it reads in greyscale and
for people who cannot tell gold from silver, and the level is also written as a word beside it:

| Level | Structure | 128 px adds | 64 px adds | 32 px keeps |
|---|---|---|---|---|
| BLUE | one hairline | Latin micro-text, -6° stamp tilt | badge with a dot | one 1.5 px line |
| SILVER | two concentric hairlines | micro-text between them, tilt | badge with one chevron | two hairlines |
| GOLD | gold band between two navy keylines, star break at the top | micro-text on the band, tilt, a cancellation tail on the end side | star break, badge with two chevrons | gold band + one keyline |

The same component draws all three sizes, so the customer recognises the stamp in the top bar (32), in the header
menu and mobile menu (64) and on the account card (128). Under it, the card answers the question the baseline could
not: **how far is the next level**, counted on spending (GTV-544), with points as a secondary number.

## Key decisions
- **One SVG, simplified downward.** Geometry follows design/references.md §7.1 (photo 24 / 50 / 100, moat 1.5 / 2 / 4,
  frame zone 2.5 / 5 / 10). At 32 px there is no star, text, badge or tilt; only the line structure survives.
- **Colour roles, not hex.** Inks are component tokens in `tokens.css`: BLUE `--pm-blue` (navy, 12.6:1), SILVER
  `--pm-silver` (slate-500, 4.8:1), GOLD a `--pm-gold` band held by `--pm-gold-key` navy keylines (gold alone is
  1.9:1 on white). In dark mode and on the navy header (`data-pm-tone="brand"`) the keylines drop away and the inks
  become the light tints (navy-200, slate-300, gold).
- **Micro-text is Latin capitals and digits only** (`GOTEAV · GOLD MEMBER · SINCE 2024`), `direction="ltr"` so it
  does not reverse in RTL; the Arabic level name sits on a straight line beside the avatar. The text is decorative
  (`aria-hidden`); the avatar's accessible name is "name, level".
- **RTL:** the tilt mirrors (-6° LTR, +6° RTL), the cancellation tail and the badge sit on the inline end.
- **Monogram:** Arabic-script names show one isolated first letter, Latin names two initials, on a solid navy disc
  (ocean in dark). A failed or expired photo link falls back to the monogram (`onError`).
- **Circle, not squircle.** A postmark is round; 04-assist-tools §3.2 proposed the squircle for concept A, which the
  Postmark replaces.
- **Spend progress** = `lifetimeSpendUsd` / (`lifetimeSpendUsd` + `nextTier.remainingSpendUsd`). The target is derived,
  never hard-coded, because customers get no tier ladder. Falls back to points when only `remainingPoints` is sent,
  "top level" when `nextTier` is null. Bar in `--action`, level ends marked with icon + word.
- **Flat navy hero (D7)** with the page title drawn again ("Welcome, Sara"); no photo, waves, orbs or gradients.
- **One primary button** ("My bookings", teal with white text); "Edit profile" is an outline button.
- **Motion:** when the level changes the frame draws once in 600 ms and "You reached Gold" appears once (polite live
  region); the progress bar eases to its new value; header menu and mobile drawer slide in. All of it is skipped
  under `prefers-reduced-motion`; nothing loops.
- **States:** loading (skeleton disc of the final size, no ring, no layout shift), loyalty error (hairline ring in the
  border colour, message + "Try again"), unknown tier code (graphite line, no badge), expired photo link (monogram),
  visitor (person icon, no frame).
- **Below xl:** the menu button carries the 32 px avatar and opens the site drawer, which ends with the 64 px account
  row; the side card's account menu is a disclosure under the card.
- Lab only: the content column shows the lab controls (fenced, dashed) and a stamp sheet with every level × size ×
  picture, the states, and the header menu and mobile row in context. URL switches: `&level=BLUE|SILVER|GOLD`,
  `&pic=photo|initial|broken`, `&state=ready|loading|error`, `&name=arabic|latin`.

## Verification (2026-11-21)
- Full page, 390 / 768 / 1440 × ar-RTL / en-LTR × light / dark at GOLD: `shots/<width>-<rtl|ltr>-<theme>.png`. No
  horizontal overflow in any of the 12.
- Header disclosure (1440 RTL): open → focus on the first link, `[role=menu]` count 0, no `aria-haspopup`; Escape →
  focus on the button; outside click → focus on the button (`shots/detail-1440-rtl-light-disclosure-open.png`).
- Drawer (390): `#root` inert, `<html>` overflow hidden, focus stayed inside for 45 Tab / Shift+Tab presses; after Escape
  or the close button, inert removed, overflow restored, focus on the menu button
  (`shots/detail-390-rtl-light-drawer-{top,bottom}.png`, `shots/detail-390-ltr-dark-drawer-top.png`).
- Theme toggle (768 LTR) visible, flips `.dark` and its own name (`shots/detail-768-ltr-theme-toggled-dark.png`).
- 32 px at DPR 1, each level on the navy bar in light and dark (`shots/pm32-1x-*.png`): BLUE a solid ring, SILVER a
  visible double ring, GOLD the gold band.
- 128 px at DPR 2 (`shots/pm128-*-x2.png`): micro-text clear of the badge in ar and en; GOLD stamp + tail centred
  (avatar 8 px toward the start, the tail 16 px past the end).
- States: `shots/state-loading-1440-rtl-dark.png`, `shots/state-error-1440-ltr-light.png`; level-up draw and
  "You reached Gold" in `shots/motion-upgrade-mid.png`.
- Lab reloads caused by other sessions interrupted some runs; each check above passed on a clean run.
- `pnpm lab:check` → "Lab: 51 versions compile."; typecheck of `web/account-header/**` with the lab tsconfig → 0 errors.

## Alternatives considered (not built)
1. **Bezel ring** (design/references.md §7.3 concept 1): a watch-bezel ring with notches and a 60-tick minute track.
   Strong at 128, but at 32 it collapses into the same plain ring as any avatar and reads technical, not travel.
2. **Progress arc as the frame** (concept 3): the ring itself is the progress to the next level. One metaphor fewer,
   but the frame would change with every booking and stop meaning "level"; fitness-ring connotation.
3. **Boarding-stub card**: the side card as a ticket stub with a perforated tear line and the avatar in the stub. Bold,
   but it repeats the e-mail design's boarding-stub motif (lab v8 of the e-mails) and fights the owner's flat-card rule.

## Open questions
- **"المكافآت والمحفظة" next to "المحفظة"** (en "Rewards & Wallet" / "Wallet") in the header panel, the drawer and the
  side menu. Both labels are the site's current ones and are kept as-is; next to each other they read as duplicates.
  Owner to choose the wording (for example "المكافآت" for the rewards page).
- **Destinations in the drawer** show names only; the baseline used template demo photos from a third-party host.
  Keep names, or add real photos later?
- **Header colour.** This version reads "navy for the header" literally: on account pages the header is flat navy and
  continuous with the hero. Should the solid header elsewhere also be navy, or white with navy text (L-07)?
- **Silver ink.** The palette has no silver; slate-500 / slate-300 is used. Acceptable, or a different neutral?
- **Micro-text content.** "GOTEAV · {LEVEL} MEMBER · SINCE {year}" needs the account's creation year in the session
  user. Add a member number later, or keep it without?
- **Cancellation tail on GOLD at 128.** It overhangs the avatar box by about 34 px on the end side. Keep it as the
  top level's signature, or drop it for a calmer card?
- **Amounts in USD.** `lifetimeSpendUsd` is USD; should the card convert to the header's display currency (Amount
  display plan) or keep USD for a level threshold?
- **Hero subtitle.** The current text promises villas, priority flights and elite rewards; this version uses
  "Your bookings, level and points in one place." Needs the owner's wording in ar/en/tr.
- **Who sees the frame.** Only the customer sees it today. If reviews ever show avatars publicly, the customer should
  be able to hide the frame and photo (04-assist-tools §3.2).
- Owner decisions applied as final (2026-11-21): D4 weights ≤ 700, D6 no 13 px (12 px only for small captions),
  D7 flat navy account hero. D3 does not apply (no photo cards).
