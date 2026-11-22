# Port plan: web/account-header v3-passport-stamp → Goteav web

Target: worktree `F:/Goteav/wt-uplift/web`, branch `feat/gtv-472-redesign-ports` (existing, owner-named; no new branch).
Hub: GTV-569 (port), GTV-545 (UserAvatar), GTV-544 (spend progress). Owner decisions 2026-11-21 applied.

## Impact map

| Real file | Change | Used by | Classification |
|---|---|---|---|
| NEW `src/components/shared/user-avatar.tsx` (+ `user-avatar-model.ts`, test) | Postmark frame, 32/64/128, photo → monogram fallback | header, mobile menu, account side card | new |
| `src/providers/auth-context.tsx` | `AuthUser` gains `firstName`, `levelCode`, `avatar`, `memberSince` (from `MeDto.avatar`, `MeDto.createdAt`, loyalty `tier.code`); existing fields unchanged | every `useAuth()` consumer (header, account pages, wallet) | additive, unaffected |
| `src/components/layout/header-top-bar.tsx` | avatar disc → `UserAvatar` 32 (button) and 64 (panel), level as word + mark. Header colours/layout unchanged (white outside account pages; GTV-548 owns redesign) | every page | needs visual check |
| `src/components/layout/mobile-header-menu.tsx` | real modal: portal, background `inert`, scroll lock, focus trap, Escape returns focus, dialog name; settings (currency, language, theme) below 640; account row with `UserAvatar` 64; demo hot-linked photos replaced by name chips | every page < lg | needs visual check |
| `src/components/layout/home-header.tsx` | body scroll lock moves into the drawer | every page | unaffected visually |
| `src/components/layout/mobile-bottom-nav.tsx` | `aria-haspopup="dialog"` on the menu button; the page reserves the bar's height (home search-button overlap) | every page < lg | needs visual check |
| `src/features/account/hero/travel-hero.tsx`, `wallet-hero.tsx`, `account-hero.tsx` | flat navy hero (D7), no photo/waves, h1 "Welcome, {first name}" + subtitle | all `/account/*` pages via `AccountShell` | needs visual check |
| `src/features/account/account-shell.tsx` | grid columns 320px, hero text | all `/account/*` | needs visual check |
| `src/features/account/account-profile-card.tsx` | passport data page: 128 avatar, level word, spend progress, points, two buttons, existing `AccountMenu` | all `/account/*` | needs visual check |
| NEW `src/features/account/rewards/level-progress.ts` (+ test) | spend-first progress (GTV-544) | profile card, `rewards-overview.tsx` | logic |
| `src/features/account/rewards/rewards-overview.tsx` | ring and "to next" text use `level-progress` (spend first); no visual change | `/account/rewards` | needs visual check |
| `src/app/globals.css` | `--pm-*` component roles (light, `.dark`, `[data-pm-tone=brand]`) | the avatar only | unaffected |
| `messages/{ar,en,tr}/domains/account.json`, `common.json`, `domains/home.json` | new keys (avatar names, progress copy, drawer/settings labels); hero subtitle replaced by the version's wording | — | i18n parity |

Not touched: `src/features/flights/**`, `src/apiEndpoint/flights/**`, `messages/*/domains/flights.json` (other agent).

## API fields used
`MeDto`: `firstName`, `lastName`, `displayName`, `email`, `avatar.{url,thumbUrl}`, `createdAt`.
`LoyaltySummaryDto`: `tier.{code,name,expiresAt}`, `nextTier.{code,name,remainingSpendUsd,remainingPoints}`,
`lifetimeSpendUsd`, `lifetimePoints`, `pointsBalance`, `availablePoints`. All exist in `src/apiEndpoint/generated/v1`.

## Risks
- Inert on body siblings while the drawer is open: popovers opened from inside the drawer portal later, so they stay live.
- Hero now prints an h1 on every account page (there was none); the content cards keep their own h2.
- Spend amounts are USD by contract (`*Usd`); shown with the site's money formatter in USD, never converted.
