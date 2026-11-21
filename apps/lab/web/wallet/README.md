---
app: web
page: wallet
route: /[locale]/account/wallet   # /[locale]/wallet only redirects here (keeps ?payment=)
live-url: http://localhost:6002/ar/account/wallet
sources:
  - src/app/[locale]/(main-page)/account/wallet/page.tsx
  - src/features/account/wallet-settings.tsx
  - src/features/account/wallet/balance-card.tsx
  - src/features/account/wallet/top-up-card.tsx
  - src/features/account/wallet/wallet-history.tsx
status: researching
---

# Wallet (customer site)

## Purpose
A signed-in traveller checks how much credit they have, understands every movement (top-ups, booking
payments, holds, refunds, points redemptions), and tops up via a hosted payment page.

## Owner decisions (2026-10-27)
- **Scope:** content only — between the wallet hero and the newsletter. Header, hero, newsletter, footer stay.
- **Business goals (all four):** encourage top-ups · trust & clarity · link to rewards · push toward booking.
- **Boldness:** fully creative — every concept bold and unconventional (layout, signature interaction, motion).
- **Identity:** stay within current tokens (navy primary, teal secondary, yellow accent, Tajawal).
- **Concepts (concepts.md):** build all three for side-by-side comparison — v2-flight-path,
  v3-departure-board, v4-twin-tanks.
- **Amounts hidden by default** behind the eye toggle, as today (keep localStorage `wallet.balance.shown`).
- **Points → wallet redemption inline** on the wallet page (same API as the rewards page).
- **Trips from the customer's own flight searches** are allowed, labelled as indicative prices, with a static
  curated-destinations fallback when the customer has no searches.

## Owner decisions after review round 1 (2026-10-27)
- **Fix all three** as new versions: v5-flight-path (from v2), v6-departure-board (from v3),
  v7-twin-tanks (from v4). v2–v4 stay frozen for comparison.
- **Hidden amounts → neutral state:** while hidden, trips show prices only (no covered / not covered /
  gap), points show the count without the $ value, and no fill level or chart reveals the balance.
- **Covered trip / "Book with your balance"** opens flight search pre-filled from that search (route,
  dates, passengers, cabin) in the same tab.
- **Backend request at port time:** add booking id + short trip label to wallet transaction references,
  and a reliable refund → booking link (recorded for the port plan).

## Owner decisions after review round 2 (2026-10-27)
- Version choice: owner reviews v5 / v6 / v7 in the lab first (round-2 scores 8.3 / 8.0 / 7.9).
- **$0 balance:** the booking button stays in the same place and always exists; it reads "Search flights"
  when amounts are hidden or the balance is 0 — never disappears (no zero tell).
- **Frozen wallet:** keep trips as inspiration with "Search flights", without coverage or pay-with-balance.
- **Hold chip while hidden:** show "1 booking on hold" without the amount, and mask the amount on the
  booking ticket too.

## Problems with the current page
- Balance shown twice (virtual card + "الرصيد" row) with the same number; "Total" vs "available" is unclear.
- Reserved amount has no explanation of which booking holds it or when it releases.
- Transactions: English backend descriptions in the Arabic UI ("Refund to wallet"), no link to the booking,
  no running balance, no filter; RESERVE then PAYMENT for the same booking reads like a double charge.
- Top-up is a plain form in a side column; no sense of value, no motivation, payment method dropdown is
  disabled until an amount is typed.
- Rewards appear only as a link inside a small grey footnote.
- Nothing connects the balance to what the customer can do with it (book a trip).

## Data available (real API — mocks must match)
- `GET /wallet` → `WalletBalanceDto { available, balance, reserved, currency: 'USD', status: ACTIVE|FROZEN }`
  (decimal strings).
- `GET /wallet/transactions?cursor&limit` → `WalletTransactionDto { id, amount, balanceBefore, balanceAfter,
  createdAt, description|null, direction: CREDIT|DEBIT, reversalOfId|null,
  reference { id, type: PAYMENT|BOOKING|REFUND|LOYALTY|TOPUP|ADMIN }|null,
  type: TOPUP|RESERVE|CAPTURE|RELEASE|PAYMENT|REFUND|REDEMPTION|ADJUSTMENT|REVERSAL }`. Cursor paging only,
  no server filters (client-side filtering of loaded items is fine).
- `POST /wallet/top-ups` (amountUsd, gateway, methodKind) → hosted redirect; limits from public settings
  (default min 5, max 5000 USD); errors: disabled, out of range, daily limit, payments unavailable.
- Payment methods by purpose `WALLET_TOPUP` (card, apple_pay, google_pay; gateways Stripe/MyFatoorah/…).
- Loyalty: `/loyalty` summary, `/loyalty/redeem` (points → wallet credit), `/loyalty/transactions`.
- Return flow `?payment=<id>` → pending / done / failed banner.

## Not in the API (a version may propose, marked as "needs backend")
Top-up bonuses/tiers, statements export, server-side filters, saved cards, auto top-up, trip suggestions
tied to balance (could reuse destinations/offers endpoints — to verify).

## Constraints
- RTL + LTR, light + dark; amounts in `<bdi dir="ltr">`; never parse decimals to floats.
- Frozen wallet: no top-up, clear notice. Loading, empty, error states required.

## Versions
| Version | Idea | Status |
|---|---|---|
| v1-baseline | current page (owner screenshot 1920 RTL light) | reference |
| v2-flight-path | cockpit + balance flight path | review (7.6) |
| v3-departure-board | split-flap trips board + gate | review (7.3) |
| v4-twin-tanks | cash & points tanks + valve | review (7.0) |
| v5-flight-path | fix round of v2 | review (8.3, 1 blocker: re-mask on hide) |
| v6-departure-board | fix round of v3 | review (8.0, no blockers; mobile gate depth) |
| v7-twin-tanks | fix round of v4 | review (7.9, 2 blockers: $0 tell, contrast) |
