# v1-baseline — current account header, menu and side card

## How this baseline was made (read first)
The backend was not running on 2026-11-21, so a signed-in account could not render: `/ar/account*` redirects a
visitor to `/ar/login`. The account frame, the header account button and the mobile-menu account row therefore have
**no live screenshots**. This baseline is:
- the code on `develop` (worktree `F:/Goteav/wt-develop/web/src`), described below with line references;
- audit screenshots from `F:/Goteav/research/web-uplift-2026-11/audit/shots/`, signed out:
  - `1440-rtl-light.png` — home at 1440, the header rail as a visitor sees it (copy of `01-home-ar-1440-light.png`);
  - `390-rtl-light.png` — the mobile slide-out menu at 390, signed out (copy of `17-mobile-menu-ar-390-light.png`);
    signed in, the bottom of this panel holds the account row described below;
  - `ref-header-solid-1440-rtl-light.png` — a page without a dark hero, showing the header's low-contrast rail (L-07).

## Components and files

| Part | File (develop) | What it draws today |
|---|---|---|
| Frame | `src/features/account/account-shell.tsx` | Hero across the top, then `grid lg:grid-cols-[300px_minmax(0,1fr)]` pulled up `-mt-32`: side card + page content. Booking detail pages skip the frame. |
| Hero switch | `src/features/account/account-hero.tsx` | `travel` (also used for rewards) or `wallet` variant. |
| Travel hero | `src/features/account/hero/travel-hero.tsx` | 220 px: navy linear gradient, two animated glow orbs (`blur-3xl`, infinite loop), airliner photo under a gradient mask, `HeroWaves`. Title/subtitle props are no longer drawn. |
| Wallet hero | `src/features/account/hero/wallet-hero.tsx` | Banknote photo under a brand gradient, two glows, dot grid, `HeroWaves`. |
| Hero waves | `src/features/account/hero/hero-waves.tsx` | Three SVG wave layers, the front one with a gold crest line. |
| Side card | `src/features/account/account-profile-card.tsx` | Glows behind a 96 px squircle (`rounded-[28px]`, `from-primary to-secondary` gradient, 36 px black-weight initial, white ring, tinted shadow) on a tilted teal→amber tile; one gold `Award` medal for every level (`:66-86`). Name 19 px/900, e-mail 12.5 px. Stats strip on a teal gradient: points, level name, "to next level" = `nextTier.remainingPoints` or "—" (`:26-47`). Two buttons, both teal (filled "My bookings" with tinted shadow + outlined "Edit profile"). |
| Account menu | `src/features/account/account-menu.tsx`, `menu/menu-list.tsx`, `menu/menu-trigger.tsx` | Inline list from lg; below lg a trigger naming the current page that opens a bottom drawer. Groups from `account-sections.ts`. |
| Header account button | `src/components/layout/header-top-bar.tsx:170-196` | 28 px teal circle with the initial (`border-highlight`, `shadow-md`), name 13 px + level 10 px (xl only), chevron. Over a hero it is `bg-black/20 backdrop-blur-md`. |
| Header dropdown | `header-top-bar.tsx:198-260` | 44 px teal circle + `ring-4`, name, e-mail, level chip, over a teal gradient wash; six links (profile, bookings, rewards, wallet, searches, favourites) + logout. |
| Mobile menu account row | `src/components/layout/mobile-header-menu.tsx:326-370` | 40 px pale-teal circle with the initial, name 13.5 px/900, e-mail 11.5 px, sign-out icon; `backdrop-blur-md` footer. |
| Session user | `src/providers/auth-context.tsx:48-57` | `initial` = first character of the name (or e-mail), upper-cased; `level` = tier name. No avatar URL, no tier code. |
| Loyalty data | `src/apiEndpoint/loyalty/*`, `LoyaltySummaryDto` in `apiEndpoint/generated/v1/types.gen.ts:10414` | Tier `code`, `name{ar,en,tr}`, `expiresAt`; `nextTier{code,name,remainingPoints?,remainingSpendUsd?}` or null; `lifetimeSpendUsd`, `lifetimePoints`, `pointsBalance`, `availablePoints`. |

## Shared components a port would touch
`header-top-bar.tsx`, `mobile-header-menu.tsx` (site-wide layout), `account-shell.tsx`, `account-hero.tsx` + `hero/*`,
`account-profile-card.tsx`, `auth-context.tsx` (add `avatarUrl`, `avatarThumbUrl`, `tierCode`), and a new shared
`UserAvatar` (none exists in `components/ui` or `components/shared`).
