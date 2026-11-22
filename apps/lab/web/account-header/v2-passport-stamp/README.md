---
version: v2-passport-stamp
title: Passport stamp
status: review # draft | review | approved | rejected | ported
base: v1-baseline
created: 2026-11-21
tokens: override # tokens.css: develop's roles (light + .dark) + --ah-* / --pm-* component tokens
touches-components: [components/layout/header-top-bar.tsx, components/layout/mobile-header-menu.tsx, features/account/account-shell.tsx, features/account/account-hero.tsx, features/account/hero/travel-hero.tsx, features/account/hero/wallet-hero.tsx, features/account/hero/hero-waves.tsx, features/account/account-profile-card.tsx, features/account/account-menu.tsx, providers/auth-context.tsx, NEW components/shared/user-avatar (Postmark)]
ported:
---

# Passport stamp

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
- **Mobile:** the menu button carries the 32 px avatar, the drawer ends with the 64 px account row; the account menu
  is a disclosure under the card.
- Lab only: the content column shows the lab controls (fenced, dashed) and a stamp sheet with every level × size ×
  picture, the states, and the header menu and mobile row in context. URL switches: `&level=BLUE|SILVER|GOLD`,
  `&pic=photo|initial|broken`, `&state=ready|loading|error`, `&name=arabic|latin`.

## Verification (2026-11-21)
- Playwright, frame `http://127.0.0.1:7320/lab/frame-web.html#/account-header/v2-passport-stamp?lang=…&theme=…&level=GOLD`:
  390 / 768 / 1440 × ar-RTL / en-LTR × light / dark, full page, in `shots/<width>-<rtl|ltr>-<theme>.png`. No horizontal
  overflow at any of the 12 (scrollWidth = clientWidth).
- Details in `shots/`: mobile drawer open (`detail-390-rtl-light-drawer.png`), header menu open
  (`detail-1440-rtl-light-dropdown.png`), side card at 2x (`detail-sidecard-*-x2.png`), loading and loyalty-error
  states, keyboard focus ring on the navy header (`focus-1440-ltr-dark.png`), the level-up draw mid-way and finished
  in RTL dark (`motion-upgrade-mid.png`, `motion-upgrade-end.png`; live region read "وصلت إلى مستوى ذهبي").
- The only console errors are the intended `files.invalid` requests of the expired-photo demo.
- Reduced motion is handled in code (`useReducedMotion`, `motion-safe:`); a screenshot under emulated reduced motion
  was lost to a lab reload caused by other sessions and was not retaken.
- Typecheck of this page's files with the lab's tsconfig: 0 errors; `pnpm lab:check`: all versions compile.

## Alternatives considered (not built)
1. **Bezel ring** (design/references.md §7.3 concept 1): a watch-bezel ring with notches and a 60-tick minute track.
   Strong at 128, but at 32 it collapses into the same plain ring as any avatar and reads technical, not travel.
2. **Progress arc as the frame** (concept 3): the ring itself is the progress to the next level. One metaphor fewer,
   but the frame would change with every booking and stop meaning "level"; fitness-ring connotation.
3. **Boarding-stub card**: the side card as a ticket stub with a perforated tear line and the avatar in the stub. Bold,
   but it repeats the e-mail design's boarding-stub motif (lab v8 of the e-mails) and fights the owner's flat-card rule.

## Open questions
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
- Decisions this version assumes: D3 not needed (no photo cards), D4 weights ≤ 700, D6 no 13 px (12 px kept only for
  small captions), D7 flat navy hero.
