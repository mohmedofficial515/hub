---
app: web
page: account-header
route: /[locale]/account/* (the frame every account page shares) + the site header account button and mobile menu
live-url:
sources:
  - src/features/account/account-shell.tsx
  - src/features/account/account-hero.tsx
  - src/features/account/hero/travel-hero.tsx
  - src/features/account/hero/wallet-hero.tsx
  - src/features/account/hero/hero-waves.tsx
  - src/features/account/account-profile-card.tsx
  - src/features/account/account-menu.tsx
  - src/components/layout/header-top-bar.tsx
  - src/components/layout/mobile-header-menu.tsx
  - src/providers/auth-context.tsx
  - src/apiEndpoint/loyalty/*
status: designing
---

# Account header and side card (customer avatar in a Postmark frame)

Hub card GTV-522, plan GTV-472 phase 3 (brief: GTV-553 / `F:/Goteav/research/web-uplift-2026-11/phase3-brief.md`).
Progress that counts spending: plan step GTV-544.

## Purpose
A signed-in customer must recognise at a glance that this is *their* account, see their rewards level and how
far they are from the next one, and reach their bookings in one tap. The same avatar identifies them in the site
header (32 px), the mobile menu and header dropdown (64 px) and the account side card (128 px).

## Problems with the current page
- The avatar is one letter everywhere, in three unrelated looks: a 28 px teal circle (header), a 40 px pale-teal
  circle (mobile menu), a 96 px gradient squircle on a tilted teal-to-amber tile (side card).
- The level is shown as a word only; the gold medal on the side card is identical for every level.
- Progress to the next level reads `remainingPoints` only. Backend tiers are spend-based (BLUE 0, SILVER USD 2,500,
  GOLD USD 10,000), so the card shows a dash and the rewards page a full ring with "0 points".
- The account hero is a gradient with moving glow orbs, an airliner photo under a gradient mask, wave layers with a
  gold crest line: everything the owner's no-gradient rule removes. The hero title is no longer drawn.
- Two primary-looking buttons in the side card, side-card glows (`blur-3xl`), tinted shadows, 12.5 / 10.5 px text.
- No photo support although the backend already stores avatars (`PUT /users/me/avatar`, `GET /users/me` → `avatar`).

## Goals
- One avatar component, a Postmark (visa-stamp) frame whose structure *and* colour encode BLUE / SILVER / GOLD,
  legible at 32, 64 and 128 px, photo or monogram, RTL and dark mode.
- Flat navy account hero (decision D7), flat surfaces, thin lines, one primary button.
- Level progress on spend (`lifetimeSpendUsd` + `nextTier.remainingSpendUsd`), points as a secondary number.

## Constraints
- RTL + LTR, light + dark; Cairo for ar/en/tr; heading weight ≤ 700; no 13 px.
- Site colours unchanged; teal primary button keeps white text; gold only as a small loyalty touch.
- Data available: `LoyaltySummaryDto` (tier code/name/expiresAt, nextTier code/name/remainingPoints/remainingSpendUsd,
  lifetimeSpendUsd, lifetimePoints, pointsBalance, availablePoints), session user (name, email, initial, level),
  `GET /users/me` → `avatar { url, thumbUrl, expiresAt } | null`. No customer endpoint lists all tiers.

## Versions
| Version | Idea | Status |
|---|---|---|
| v1-baseline | current header, menu and side card (code + audit shots; signed-in state could not render) | reference |
| v2-passport-stamp | navy header and hero as one passport cover; side card as the data page with the Postmark avatar | review |
