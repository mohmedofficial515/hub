# v1-baseline — components

| Component | File | Shared? |
|---|---|---|
| WalletSettings (page shell) | `web/src/features/account/wallet-settings.tsx` | wallet-only |
| AccountHero → WalletHero | `features/account/account-hero.tsx`, `features/account/hero/wallet-hero.tsx` | AccountHero shared by ~10 account pages (out of scope) |
| BalanceCard (virtual card + summary, eye toggle, frozen notice, rewards link) | `features/account/wallet/balance-card.tsx` | wallet-only |
| TopUpCard + TopUpResult | `features/account/wallet/top-up-card.tsx` | wallet-only |
| WalletHistory (grouped by day, show more) | `features/account/wallet/wallet-history.tsx` | wallet-only |
| SpotlightCard | `features/account/account-settings.tsx:28` | shared, 39 files |
| CardTitle, CARD | `features/account/trip/card-title.tsx` | shared, 14 files |
| DynamicInput | `components/shared/dynamic-input` | shared, 35 files |
| DynamicSelect | `components/shared/dynamic-select` | shared, 21 files |
| Skeleton | `components/ui/skeleton` | shared |

Porting note: a redesign that keeps changes inside the wallet-only files touches no other page. Changing
SpotlightCard / CardTitle / DynamicInput / DynamicSelect would ripple to many account pages.

i18n: `messages/{ar,en,tr}/domains/account.json` → `walletSettings.*`.
