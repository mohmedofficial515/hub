# Review — web/account-header/v2-passport-stamp   (2026-11-21)

Reviewer: ux-critic (independent). Evidence: Playwright in an isolated context, frame
`http://127.0.0.1:7320/lab/frame-web.html#/account-header/v2-passport-stamp`, 390 / 768 / 1440 × ar-RTL / en-LTR ×
light / dark, DPR 1 and 2, keyboard walk, computed contrast. Source read: `page.tsx`, `tokens.css`,
`parts/postmark.tsx`, `parts/site-header.tsx`, `parts/side-card.tsx`, `parts/account-avatar.tsx`, `parts/model.tsx`.

| Pillar | Score /10 | One-line verdict |
|---|---|---|
| Hierarchy & focus | 8 | The Postmark is the one loud element; name, level word and spend progress follow in a clear order. |
| Task flow & speed | 7 | "How far to the next level" now answered in one glance; the phone drawer loses language, currency and account links. |
| Layout & responsiveness | 8 | No horizontal overflow at any of 12 captures; the 768 side-by-side card works; 1440 hero has a large empty navy field. |
| RTL / bilingual | 8 | Tilt, tail, badge, drawer slide and amounts mirror correctly; Latin micro-text stays LTR; mixed-script names hold. |
| Accessibility | 6 | Good names and live region, 44 px targets; the header menu and drawer fail keyboard/ARIA basics. |
| Visual craft & originality | 8 | A distinctive, on-brand idea that stays flat and quiet; level legibility at 32 px on navy is the weak point. |
| Motion & feedback | 7 | One-shot draw, eased bar, reduced-motion respected; Escape drops focus to `<body>`. |

**Overall: 7.4 / 10**

Owner rules checked (not findings): navy `#1f325c` + teal button with white text (2.57:1, owner-accepted, noted);
gold only in the frame, badge and tail; flat surfaces and hairlines; one primary button ("My bookings"); flat navy
hero, no gradient; no card stripes; Cairo; weights ≤ 700; no 13 px (12 px captions only). All respected.

## Blocking issues (must fix before approval)

1. **Header account menu is announced as a menu but does not behave as one.**
   `parts/site-header.tsx:259` (`aria-haspopup="menu"`) and `:293` (`role="menu"`); the items in
   `AccountDropdownPanel` (`:77`, `:92`) have no `role="menuitem"` (measured: 1 menu, 0 menuitems). Opening with
   Enter leaves focus on the button, ArrowDown does nothing, and **Escape moves focus to `<body>`** (measured at
   1440 RTL) because `onKey` (`:187`) closes without returning focus. A screen-reader user hears "menu" and then
   finds no items; a keyboard user is dropped at the top of the document.
   Fix: either make it a disclosure (`aria-haspopup` off, `aria-controls`, plain list of links, no `role="menu"`)
   or a real menu (menuitems, focus first item on open, arrows/Home/End). Either way return focus to the button on
   Escape and on outside click.

2. **Mobile drawer is not modal for keyboard and drops features the current drawer has.**
   `parts/site-header.tsx:337-368`. `aria-modal="true"` is set but there is no focus trap: Tab from the last drawer
   control continues into the page behind ("حجوزاتي", "تعديل الملف", lab inputs; measured). Body scroll is not locked
   (`overflow: visible`). At < 640 px the currency and language buttons are `hidden sm:flex` (`:226`, `:235`) and the
   drawer has neither, so **on a phone there is no way to change language or currency**. The drawer also has none of
   the six account links the desktop menu offers, and drops the baseline drawer's services and destinations
   (`v1-baseline/390-rtl-light.png`). Its title "قائمة الحساب" (`:348`) names it an account menu although it holds the
   site navigation.
   Fix: trap focus and lock scroll while open; add language + currency rows; keep the existing drawer sections and
   only replace its account row; title it as the site menu (or name the account part separately).

## Improvements

- **Major, BLUE vs SILVER at 32 px on navy** (`tokens.css:165-168`, `parts/postmark.tsx:44-52`). On the navy bar
  BLUE ink `navy-200` and SILVER ink `neutral-300` are 1.05:1 apart, so only structure separates them, and the two
  SILVER hairlines are 0.55 px apart at 32 px. At DPR 2 the double line reads; at DPR 1 it is a fuzzy single ring
  (`pm32-1x-BLUE-1200.png`, `pm32-1x-SILVER-1200.png`). From 1024 to 1279 px and on phones the level word is not shown
  beside the avatar, so this is the only cue. Fix: widen the SILVER gap at 32 (e.g. r 13.6 / 15.6, 1 px lines) or make
  BLUE a single thicker line; consider a 1-step-darker SILVER tint on brand tone.
- **Major, badge covers the micro-text at 128** (`parts/postmark.tsx:369-378`). The badge sits on the ring and hides
  part of "SILVER MEMBER" / "GOLD MEMBER" (`pm128-SILVER-initial-dark.png`, `pm128-GOLD-photo-light.png`). Either start
  the text after the badge or leave a gap in the text path behind it.
- **Major, theme switch missing from the header.** The baseline header has a light/dark toggle
  (`v1-baseline/1440-rtl-light.png`); v2's header does not. If porting replaces `header-top-bar.tsx`, the toggle is lost.
- **Minor, GOLD 128 avatar looks off-centre.** The cancellation tail overhangs ~34 px on the end side, so in the
  centred card the stamp visually shifts (`1440-rtl-light.png`, `390-rtl-dark.png`). If kept, balance it with the
  `p-1` wrapper offset, or drop it (open question in README).
- **Minor, hamburger name.** `parts/site-header.tsx:310` names the button "فتح القائمة" while it shows the customer's
  stamp; the avatar's own name is hidden inside. Acceptable, but "القائمة — سارة، مستوى ذهبي" would match what is seen.
- **Minor, two `<nav aria-label="primary">`** (`:218`, `:362`), English text in an Arabic page and duplicated when the
  drawer is open. Use translated labels.
- **Minor, menu copy.** Dropdown and side menu list both "المكافآت والمحفظة" and "المحفظة" (inherited labels); the pair
  is confusing next to each other. Flag to the owner, do not invent new wording.
- **Minor, states look alike.** "Loyalty not loaded" (border-strong, 1.48:1 on white) and "Unknown level code" rings
  are close to BLUE at 32/64; they always come with text, so not a blocker.
- **Minor, LevelMark uses an inset box-shadow as a keyline** (`parts/account-avatar.tsx:42`). It renders as a 1 px
  line, so it meets "thin lines", but use `outline`/`border` so the port does not carry a shadow utility.
- **Note, focus ring on navy**: `--ring` teal-600 on navy-800 is 3.39:1 (passes 3:1 non-text); white on teal button
  2.57:1 is owner-accepted.

## What is better than baseline

- Level is now said twice without colour: structure (one / two lines / band + star) and a badge glyph (dot, chevron,
  two chevrons) plus the word. Baseline gave every level the same gold medal.
- The card answers "how far to the next level" with spend, target and remainder; baseline showed "—" when
  `remainingPoints` was missing.
- Hero is flat navy without orbs, waves, photo or infinite animation; header and hero read as one surface.
- One primary button; "Edit profile" is a neutral outline instead of a second teal button.
- Text sizes: name 20 px, e-mail 14 px, nothing at 12.5 / 13.5 / 10 px as in baseline.
- Loading, loyalty-error, unknown-code, expired-photo and visitor states are all designed and fall back cleanly.
- Contrast: muted text 4.76:1 (light) and 6.95:1 (dark); header text navy-200 on navy-800 8.86:1.

## Screenshots

In this folder: `{390,768,1440}-{rtl,ltr}-{light,dark}.png` (viewport, GOLD; the LTR captures keep the Arabic name
as a mixed-script check); `pm128-{BLUE,SILVER,GOLD}-{photo,initial}-{light,dark}.png` (DPR 2);
`pm32-header-{BLUE,SILVER,GOLD}-light.png` (DPR 2); `pm32-1x-{BLUE,SILVER}-1200.png` (DPR 1, no level word);
`sheet-en-{light,dark}.png` (full stamp sheet); `detail-1440-rtl-light-dropdown-focus.png`;
`detail-390-rtl-light-drawer.png`; `detail-390-ltr-dark-drawer.png`. `_cmp32*.png` are side-by-side helpers.

## Fixes after review (2026-11-21, redesign-director)

v2 is in `review`, so it is not edited: every fix below is in **`../../v3-passport-stamp/`** (`base: v2-passport-stamp`).

| Finding | Fix in v3 | Verified |
|---|---|---|
| Blocking 1: header menu announced as a menu | Disclosure: button with `aria-expanded` + `aria-controls`, no `aria-haspopup`/`role="menu"`, plain list of links. Focus moves to the first link on open; Escape closes and returns focus to the button; outside click closes and returns focus unless another control was clicked; tabbing out closes. | 1440 RTL: open → focus on "البيانات الشخصية", `[role=menu]` count 0; Escape → focus on the button; outside click → focus on the button. |
| Blocking 2: drawer not modal, features lost | Portal drawer, `#root` `inert`, `<html>` `overflow: hidden`, Tab/Shift+Tab trapped, Escape and the close button return focus to the menu button. Titled "قائمة الموقع / Site menu". Sections: navigation, services (non-flight "soon"), popular destinations (the baseline's four names as chips; its photos are hot-linked template demo images), my account (the six links), and below 640 px language + currency + theme. | 390 RTL: inert true, overflow hidden, focus never left the dialog in 45 Tab/Shift+Tab presses; after close inert false, overflow restored, focus on the menu button. |
| Major: BLUE vs SILVER at 32 on navy | BLUE one 2 px line; SILVER two 1 px lines, 1 px clear gap (r 13.5 / 15.5); SILVER ink on navy and in dark is neutral-400 (was neutral-300). | `v3…/shots/pm32-1x-*-{light,dark}.png` at DPR 1: solid ring vs visible double ring. |
| Major: badge covers micro-text at 128 | Text runs skip a 42° arc behind the badge (bottom-end, after the tilt) and, at GOLD, the star. | `v3…/shots/pm128-*-x2.png` (ar + en). |
| Major: theme toggle missing | Toggle in the header from 640 px, in the drawer below 640 px; named "switch to dark / light mode". | 768 LTR: visible, toggles `.dark`, name flips. |
| Minor: GOLD 128 off-centre | Tail shortened to 16 px overhang; the card pads the start side by the same, so stamp + tail are centred as one mark. | Avatar centre is offset 8 px toward the start at GOLD, 0 at BLUE/SILVER. |
| Minor: two English `nav` labels | One translated label ("التنقل الرئيسي / Main navigation"); header nav is `display: none` below xl, the drawer's nav exists only while open. | 1440: 1 visible nav with the Arabic label. |
| Minor: hamburger name | "القائمة، {name}، مستوى {level}". | — |
| Minor: LevelMark inset box-shadow | 1 px `border`. | No `shadow-` utilities left in `parts/`. |
| Minor: "المكافآت والمحفظة" next to "المحفظة" | Kept as-is (site labels); listed under open questions in v3 README. | — |
| Also | Account button and inline nav now start at xl (1280); below that the drawer is used, so 1024–1279 px is no longer without navigation. | — |

Checks: `pnpm lab:check` (Hub root) → "Lab: 51 versions compile."; `npx tsc -p <scratchpad>/tsconfig.ah.json` (extends
`apps/lab/tsconfig.json`, only `web/account-header/**`) → exit 0; Playwright 390 / 768 / 1440 × ar / en × light / dark
full page → no horizontal overflow in any of the 12 (`v3…/shots/<w>-<dir>-<theme>.png`).
