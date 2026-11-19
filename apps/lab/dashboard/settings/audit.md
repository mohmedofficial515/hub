---
page: dashboard/settings
kind: audit
date: 2026-11-18
sources:
  - backend: src/modules/settings/groups/*.settings.ts, domain/settings-controls.ts, settings.permissions.ts, settings.api.md
  - backend: src/config/env.schema.ts, modules/payments/application/gateway-credentials/gateway-credential-specs.ts
  - dashboard (branch feat/cartat-whatsapp): src/features/settings/**, src/stores/use-settings-store.ts,
    src/lib/i18n/dictionaries/{ar,en}/settings.json, src/apiEndpoint/settings/**
mock: shared/mocks/settings/ (index.ts)
---

# Settings audit

Read-only review of every settings group, the two special pages and the three personal preference tabs, for the
settings redesign. Nothing in the backend or the dashboard was changed. Proposals are marked **P0** (needed for the
redesign or launch), **P1** (should come with or soon after the redesign), **P2** (worth having later), and
**[backend]** when a field alone is not enough (the server must read it or behave differently).

## 0. Inventory (what really exists)

| Where | Count | Notes |
|---|---|---|
| Backend registry `SETTINGS_GROUPS` | **33** groups | `groups/index.ts` |
| Dashboard catalog `ORGANISATION_GROUPS` | **31** groups + 2 special pages | 7 sections; the brief's "30" is 31 |
| Registered but **not shown** | `pricing` | one field (`rulesSource`); labels exist in the dictionary, no catalog entry |
| New, **not in the dashboard at all** | `maintenance` | added 2026-11-18 (docs/32); the generated client (`SettingsAdminKey`) has no `maintenance`, no labels |
| Special pages (not groups) | `org-payment-gateways`, `org-whatsapp-provider` | permission `payments.gateway_credentials` / `notifications.manage_providers` |
| Personal preferences (browser) | 3 tabs | appearance, tables, notifications (`useSettingsStore`, localStorage `dashboard-settings`) |

Platform mechanics that already exist (so they are **not** proposals):

- Every group is a versioned JSON document: `version`, `schemaVersion`, `updatedAt`, `updatedById`; every write appends a
  history row with `value`, `previousValue`, `changedById`, `reason`, `requestId`.
- Rollback to any version (`_rollback`), optimistic lock (`expectedVersion`, 409 conflict), JSON Schema + defaults per
  group (`_schema`) so the form is generic.
- Two permission tiers on top of `settings.write`: **controls** (`settings.write_controls`, list in
  `MONEY_SETTINGS_CONTROL_KEYS` + `SECURITY_SETTINGS_CONTROL_KEYS`) and **security settings** that only the owner
  (`settings.security_direct`) applies at once; anyone else files a **change request** approved by a second admin
  (`settings.security_approve`). Queue page: `/team/security-requests` (`lib/security-requests.ts`,
  `security-change-requests-page.tsx`). Money-approval switches (`agent_booking_policy.manualPayment*`,
  `refund_policy.offlineSettlement`) take the same two-person path (phase 9).
- Dashboard group editor already has: draft + explicit Save, optional reason (500 chars), review dialog with
  before → after per path, discard, conflict banner, history sheet with per-version diff and rollback, density and
  "show keys" toggles, per-row "modified" marker and default chip, lock reason on controls, pending-request banner.

Dictionary gaps (labels fall back to raw English from the schema):

- `maintenance`: no entry at all (title, summary, fields).
- `flights.fareCalendar.*` (8 fields), `notifications.opsAlerts.routing.*`, `.telegramChatIds`, `.burstLimit`,
  `retention.staffInboxDays`, `.clientErrorDays`, `.clientErrorMaxRows`, `verification_policy.phoneOtpFallbackChannel`.
- Stale: `platform.maintenance.*` entries and `groupSummaries.platform` ("Brand, locales **and maintenance**") still
  describe the block that moved to the `maintenance` group; `settings.api.md` still says the app config reads the
  maintenance flag from `platform`.

---

## 1. Section: Platform & security (`access`)

### 1.1 `platform` — Platform (المنصّة) · v3

Purpose: brand, support contacts, locales, display currency, time zone, product feature switches and legal links.

| Key | Type | Default | Range / options | Controls |
|---|---|---|---|---|
| siteName | string | `Goteav` | 1–80 | brand name in e-mails and UI |
| supportEmail | email | `support@goteav.com` | ≤254 | support contact |
| supportPhone | string? | null | E.164 ≤32 | shown on contact / maintenance page |
| supportWhatsapp | string? | null | E.164 ≤32 | WhatsApp support link |
| defaultLocale | enum | `en` | en, ar, tr | locale with no visitor preference |
| supportedLocales | multi-enum | all | must include default | locales offered on web |
| defaultCurrency | currency | `USD` | ISO 4217 | display currency before the visitor picks one |
| timezone | IANA | `UTC` | valid zone | operational reports and admin displays |
| features.flights / hotels / esim / packages | boolean | true / false / false / false | | product switches |
| features.wallet / loyalty / guestCheckout | boolean | true / true / true | | wallet, loyalty, bookings without account |
| legal.termsUrl / privacyUrl | https url? | null | | footer legal links |

Sub-sections: **Brand & contact** (siteName, supportEmail, supportPhone, supportWhatsapp) · **Languages & region**
(defaultLocale, supportedLocales, defaultCurrency, timezone) · **Products & features** (features.*) · **Legal** (legal.*).

Missing settings:

| Id | Key | Type | Default | Why | Pri |
|---|---|---|---|---|---|
| S-01 | legal.kvkkNoticeUrl | url? | null | The company is registered in Türkiye (D-1): KVKK requires the *aydınlatma metni* wherever personal data is collected (sign-up, checkout, traveller vault). Only terms and privacy exist. | **P0** [backend: schema, public projection, web footer/forms] |
| S-02 | company.tursabLicenseNo | string? | null | A Turkish travel agency must show its TÜRSAB document number on the site, tickets and e-mails. Not found anywhere in the code. Confirm the licence status with the accountant/lawyer. | **P0** [backend + web + e-mail templates] |
| S-03 | legal.refundPolicyUrl | url? | null | Cancellation/refund terms page linked from checkout and the void-window notice. | P1 [backend] |
| S-04 | legal.cookiePolicyUrl | url? | null | Cookie banner / analytics consent link. | P1 [backend] |
| S-05 | supportHours | localized text? | null | Shown with the support contacts and on the maintenance page (`maintenance.showContacts`). | P2 [backend] |

Overlaps: `features.wallet` / `features.loyalty` are top-level switches while `loyalty.enabled`,
`refund_policy.allowWalletTopup` and `payment_methods.walletPayments.enabled` switch parts of the same features → the
group page must say "the product switch here wins; the detailed switches live in …". `timezone` defaults to UTC
while every dashboard date-time input is fixed to Riyadh (+03:00, `setting-row.tsx` `isoToRiyadhWall`) → explain or
align (see §9).

### 1.2 `maintenance` — Maintenance mode (backend only) · v1

Purpose: close the whole customer platform or chosen areas, now or in a scheduled window, with a banner, a drain
period, a team allow-list and bypass links. Enforced (503 + Retry-After), unlike the old `platform.maintenance`.

| Key | Type | Default | Range / options | Controls |
|---|---|---|---|---|
| enabled | boolean | false | | master switch ("now, until off" without a window) |
| scope | enum | `full` | full, areas | whole platform or areas |
| areas | multi-enum | [] | flights_search, flights_booking, bookings_manage, payments, wallet, loyalty, accounts, sign_in, support | closed areas (≥1 when scope = areas) |
| title / message | localized? | null | ≤500 | page heading and body |
| window.startsAt / endsAt | datetime? | null | end > start | scheduled window; drives countdown |
| announce.enabled / leadMinutes / message | bool / int / localized? | true / 1440 / null | 0–10080 | banner before the start |
| drainMinutes | int | 15 | 0–180 | new checkouts and top-ups stop before start |
| retryAfterMinutes | int | 30 | 1–1440 | Retry-After without an end |
| allowAdmins | boolean | true | false needs an allow-list entry | keep the dashboard reachable |
| allowlist | list {cidr,label} | [] | ≤100 | addresses that see the real platform |
| bypassTokens | list | [] | ≤20, managed by `/admin/maintenance/bypass-tokens` | bypass links (never edited as a field) |
| showContacts | boolean | true | | support contacts on the page |
| statusUrl | https url? | null | | "follow updates" link |

Sub-sections: **Switch & scope** · **Schedule & announcement** · **Customer message** · **Team access** (allowAdmins,
allowlist, bypass links as a managed list).

Missing: the group itself is missing from the dashboard (**P0**, F-03: sync the API client, add a catalog entry and
labels). It deserves a status card on the overview (phase `off / scheduled / draining / active / ended` exists in
`shared/kernel/maintenance.ts`). No missing fields.

### 1.3 `security` — Security (الأمان) · v2 · security controls

Purpose: brute-force lockout, login alerts, admin IP allow-list, invite lifetimes, login-history retention, the phone
and magic-link sign-in methods and the recent-authentication window.

| Key | Type | Default | Range | Controls |
|---|---|---|---|---|
| lockout.enabled | boolean | true | | master switch of the lockout (security) |
| lockout.maxFailures | int | 5 | 1–50 | failures in the window before lock |
| lockout.windowMinutes | minutes | 15 | 1–1440 | counting window |
| lockout.backoffMinutes | int list | [1,5,15,60] | 1–10 steps, non-decreasing | lock duration ladder |
| lockout.resetAfterHours | hours | 12 | 1–168 | quiet time that resets the ladder |
| lockout.notify | boolean | true | | e-mail the owner of a locked account |
| loginAlerts.admin / customer | enum | always / new_device_or_location | always, new_device_or_location, off | login alert e-mails |
| adminIpAllowlist.enabled / cidrs | bool / list | false / [] | ≤50, ≥1 when on | admin area network allow-list |
| invites.ttlHours / temporaryPasswordTtlHours | hours | 48 / 24 | 1–336 | staff invitation lifetimes |
| loginHistory.successRetentionDays / failureRetentionDays | days | 365 / 30 | 1–3650, failure ≤ success | login history retention |
| loginHistory.pruneBatchSize / pruneMaxBatches | int | 5000 / 200 | | prune job tuning |
| phoneLogin.enabled / signupEnabled | boolean | true / true | | customer sign-in (and sign-up) by phone code |
| magicLink.enabled / ttlMinutes | bool / int | true / 15 | 5–60 | e-mailed sign-in link |
| recentAuthMinutes | minutes | 10 | 1–60 | "recent sign-in" window for sensitive actions |

Sub-sections: **Staff access** (adminIpAllowlist, invites, loginAlerts.admin) · **Lockout** · **Customer sign-in
methods** (phoneLogin, magicLink, loginAlerts.customer, recentAuthMinutes) · **Login history** (retention + prune,
housekeeping).

Missing:

| Id | Key | Type | Default | Why | Pri |
|---|---|---|---|---|---|
| S-06 | adminSession.idleTimeoutMinutes | minutes | 30 | Today the env `ADMIN_IDLE_TIMEOUT` (30m); the owner cannot tighten it for a shared office PC without a deploy. | P1 [backend reads the setting; security control] |
| S-07 | adminSession.maxSessionHours | hours | 12 | Today the env `ADMIN_REFRESH_TTL` (12h): how long a staff sign-in lives at most. | P1 [backend] |
| S-08 | passwordPolicy.staffMinLength | int | 12 | `PASSWORD_MIN_LENGTH` is a code constant (8) for staff and customers alike. | P2 [backend] |

Overlaps: `verification_policy.adminTotpRequired` is a **staff** access rule living in a **customer** verification
group → show it under Security › Staff access (keep the backend key, or move it in a schema migration, P2).
`loginHistory.prune*` are housekeeping like `audit.batchSize` → group them under an "Advanced" fold.

### 1.4 `verification_policy` — Verification policy (سياسة التحقّق) · v2 · partly security

Purpose: e-mail / phone verification required for booking, admin TOTP, and the one-time code parameters.

| Key | Type | Default | Range / options | Controls |
|---|---|---|---|---|
| requireVerifiedEmailForBooking | boolean | true | | registered users verify e-mail before paying (security) |
| guestEmailOtpRequired | boolean | true | | guests confirm e-mail by code (security) |
| phoneVerificationEnabled | boolean | true | | offer phone verification |
| phoneVerificationRequiredForBooking | boolean | false | | verified phone before paying (security) |
| adminTotpRequired | boolean | true | | staff must enrol TOTP (security) |
| otp.length | int | 6 | 4–8 | digits |
| otp.ttlSeconds | seconds | 300 | 0–2 592 000 | code lifetime |
| otp.maxAttempts | int | 5 | 1–10 | wrong attempts |
| otp.resendCooldownSeconds | seconds | 60 | | resend wait |
| otp.dailyLimit | int | 10 | 1–100 | codes per identifier per day |
| phoneOtpChannel | enum | WHATSAPP | WHATSAPP, SMS | phone code channel |
| phoneOtpFallbackChannel | enum | EMAIL | EMAIL, NONE | re-auth fallback when WhatsApp is down |

Sub-sections: **Booking requirements** · **One-time codes** · **Phone channel** · (adminTotpRequired shown in Security).

Missing: none. Note: `phoneOtpChannel = SMS` is selectable but `SMS_PROVIDER` only knows `none | fake` → the option
must say "needs an SMS provider" (see notifications).

### 1.5 `security_alerts` — Security wave alerts (تنبيهات موجات الأمان) · v1 · all security controls

Purpose: ops alerts on waves of failed staff sign-ins, staff lockouts and refused staff actions.

| Key | Type | Default | Range | Controls |
|---|---|---|---|---|
| enabled | boolean | true | | master switch |
| windowMinutes | minutes | 60 | 5–1440 | counting window (job runs every 15 min) |
| failedAdminLogins | int | 30 | 1–100 000 | `security.login_failure_wave` |
| lockedStaffAccounts | int | 3 | | `security.lockout_wave` |
| refusalsPerActor | int | 10 | | `security.refusal_wave` |

Sub-sections: one (Thresholds). Missing: none. Overlap: where the alerts go is `notifications.opsAlerts` → link to it.

### 1.6 `abuse_protection` — Abuse protection (الحماية من الإساءة) · v2 · all security controls

Purpose: SMS/WhatsApp code budgets and countries, breached-password check, sign-in CAPTCHA, the answer to a sign-up
with a taken e-mail (D-8) and token-refresh limits.

| Key | Type | Default | Range / options | Controls |
|---|---|---|---|---|
| otpBudget.enabled | boolean | true | | phone code budgets |
| otpBudget.phoneDailyLimit | int | 2000 | 1–1 000 000 | all phone codes / rolling 24 h |
| otpBudget.perCallingCodeDailyLimit | int | 300 | | per country calling code |
| otpBudget.alertAtPercent | int % | 80 | 1–100 | early ops alert |
| otpCountries.mode / countries | enum / list | all / [] | all, allow, deny; ISO-2 | which phone countries get codes |
| breachedPasswords.enabled | boolean | false | | k-anonymity breach check on new passwords |
| captcha.enabled | boolean | false | needs `TURNSTILE_SECRET_KEY` | sign-in / sign-up CAPTCHA |
| captcha.failuresPerIpBeforeChallenge | int | 5 | 1–1000 | |
| captcha.windowMinutes | minutes | 15 | 1–1440 | |
| captcha.alwaysOnSignup | boolean | false | | CAPTCHA on every sign-up |
| signup.existingEmail | enum | generic | generic, explicit | D-8 answer |
| signup.notifyExistingOwner | boolean | true | | mail the existing owner |
| refreshLimits.perSessionPerMinute / perIpPerMinute | int | 10 / 300 | 1–60 / 1–1000 | `POST /auth/refresh` limits |

Sub-sections: **Phone code budgets** (otpBudget + otpCountries) · **Passwords & sign-up** (breachedPasswords, signup)
· **CAPTCHA** · **Session refresh limits**.

Missing: S-11 `signup.blockDisposableEmail` (boolean, false) — refuse throw-away e-mail domains at sign-up, which
feeds the wallet top-up and card-testing defences. P2 [backend].

Overlap: two CAPTCHAs — this one (customer sign-in) and `flight_guards.searchGuard.captcha` (guest searches), same
Turnstile key. Keep both (different owners), but show a shared "CAPTCHA key configured: yes/no" hint on both.

## 2. Section: Customers & travellers (`customers`)

### 2.1 `account` — Customer accounts (حسابات العملاء) · v1 *(currently in `access`)*

Purpose: deletion grace period and personal data export limits.

| Key | Type | Default | Range | Controls |
|---|---|---|---|---|
| deletion.graceDays | days | 30 | 1–90 | delay before erasure; customer can cancel |
| export.linkTtlDays | days | 7 | 1–30 | export archive lifetime |
| export.cooldownHours | hours | 24 | 0–720 | wait between two exports |

Sub-sections: **Deletion** · **Data export**.

Missing:

| Id | Key | Type | Default | Why | Pri |
|---|---|---|---|---|---|
| S-09 | deletion.walletBalancePolicy | enum | block | What happens to a wallet balance (and upcoming trips) when an account is deleted: block the request, refund CASH to the card, or forfeit. Not visible in the settings; behaviour in the identity/wallet code not confirmed in this audit. | P1 [backend] |
| S-10 | dormant.afterMonths | int? | null | KVKK data minimisation: flag or anonymise accounts with no activity. | P2 [backend] |

Recommendation: move `account` from `access` to the customers section (it is the customer's lifecycle, not sign-in).

### 2.2 `travellers` — Travellers (المسافرون) · v1

Purpose: saved-traveller limit, passport validity warning and the documents vault quotas.

| Key | Type | Default | Range | Controls |
|---|---|---|---|---|
| maxTravellers | int | 20 | 1–100 | saved travellers per account (self included) |
| passportValidityMonths | months | 6 | 0–12 | validity after last arrival before a warning |
| vault.maxFileBytes | bytes | 10 000 000 | 100 KB–50 MB | largest file |
| vault.maxFilesPerDocument | int | 4 | 1–20 | pages per document |
| vault.quotaBytes | bytes | 200 000 000 | 1 MB–5 GB | per-account vault quota |
| vault.expiryReminderDays | int list | [180, 90, 30] | ≤6, 1–730 | document expiry reminders |

Sub-sections: **Saved travellers** · **Documents vault**.

Missing: S-12 `collectPassportAtBooking` enum (supplier_required | international | always), default
supplier_required — collect document details even when the airline does not ask, for international trips. P2 [backend].

### 2.3 `loyalty` — Loyalty (الولاء) · v4 · money controls

Purpose: earning rate, tiers, redemption, expiry, pending points until travel and clawback.

| Key | Type | Default | Range / options | Controls |
|---|---|---|---|---|
| enabled | boolean | true | | master switch |
| pointsPerUsd | number | 1 | 0–1000 | earn rate (control) |
| multipliers.byProduct.FLIGHT | number | 1 | 0–10 | per product (control) |
| tiers[] (BLUE 0 / SILVER 2500 / GOLD 10000 USD) | list | 3 tiers | ≤10, ascending | code, name, threshold type/amount, validityMonths 12, multiplier 1/1.25/1.5, discountPercent 0, benefits (control except name/benefits) |
| redemption.enabled | boolean | true | | points → wallet |
| redemption.pointValueUsd | money | 0.01 | 0–100 | (control) |
| redemption.minPoints | int | 500 | ≥0 | |
| redemption.maxPointsPerRedemption | int? | null | ≥1 | (control) |
| redemption.maxPercentOfBookingTotal | % | 50 | 0–100 | (control) |
| expiry.enabled / monthsAfterEarn / reminderDaysBefore | bool / int / list | true / 24 / [30, 7] | 1–120 | FIFO expiry |
| earnTrigger | enum | BOOKING_CONFIRMED | BOOKING_CONFIRMED, BOOKING_PAID | |
| manualGrantRequiresApproval | boolean | true | | staff grants need a second approver (control) |
| maxManualGrantPoints | int? | null | ≥1 | grant cap (control) |
| pending.enabled / releaseAfter / daysAfterTravel / fallbackDays | | true / DEPARTURE / 1 / 30 | DEPARTURE, RETURN | D-3 pending points (control) |
| clawback.fromOtherPoints / fromWallet / uncovered | | true / true / CARRY_DEBT | CARRY_DEBT, WRITE_OFF | redeemed points of cancelled bookings (control) |

Sub-sections: **Programme** (enabled, earnTrigger) · **Earning** (pointsPerUsd, multipliers) · **Tiers** (table editor)
· **Redemption** · **Expiry** · **Pending & clawback** · **Staff grants**.

Missing: S-13 `referral.enabled` / `referral.bonusPoints` — referral programme (no module exists). P2 [backend, new
feature]. Overlap: `platform.features.loyalty` vs `enabled` (explain which wins: the product switch hides the whole
programme).

## 3. Section: Payments & refunds (`payments`)

### 3.1 `payment_methods` — Payment methods (طرق الدفع) · v2

Purpose: gateway accounts (which methods, currencies, countries, order), visibility rules, fallback and wallet payments.

| Key | Type | Default | Range / options | Controls |
|---|---|---|---|---|
| gateways[] | list ≤7 | STRIPE on; MYFATOORAH, PAYMOB, MOYASAR, TAP, PAYTR, IYZICO off | per entry: enabled, credentialsRef, displayName (ar/en/tr), currencies, countries, methods, sortOrder | what can be offered |
| rules[] | rule DSL | [] | conditions on currency, country, amountUsd, productType, purpose, userTier, role, isGuest, date, channel; action show/hide/order | who sees what |
| fallback | {gateway, method}? | STRIPE / card | | offered when rules leave nothing |
| walletPayments.enabled / allowPartial / minPartialUsd | bool / bool / money | true / true / 1 | 0–1 000 000 | pay from wallet |

Sub-sections: **Gateways** (one card per gateway: on/off, methods, currencies, countries, order) · **Visibility
rules** (rule editor) · **Fallback** · **Wallet payments**.

Missing: none at field level (installments are a gateway credential, `maxInstallment`).

Overlaps: (1) switching a gateway on happens here, its keys on the **Payment gateways** page → each gateway card here
should show "keys: saved here / from .env / none" and link; the gateways page already says "switch it on in Payment
methods". (2) `credentialsRef` (env reference name) predates the dashboard keys (ADR 0020, the saved keys win) →
show it read-only under "Advanced". (3) `walletPayments` belongs to the Wallet view (§3.2).

### 3.2 `refund_policy` — Refund policy (سياسة الاسترداد) · v6 · money + two-person controls

Purpose: refund destination and incentive, automatic refunds, second approval of staff and offline refunds, the
failed-booking refund choice, **and** wallet top-up limits and the wallet spend order.

| Key | Type | Default | Range / options | Controls |
|---|---|---|---|---|
| destination | enum | CUSTOMER_CHOICE | ORIGINAL_METHOD, WALLET, CUSTOMER_CHOICE | where refunds go |
| walletIncentivePercent | % | 0 | 0–100 | bonus for a wallet refund (control) |
| autoRefundOnSupplierCancellation | boolean | true | | refund when the airline cancels |
| refundProcessingDays | int | 10 | 0–60 | days shown to customers |
| approvalThresholdUsd | **decimal string** | "0.00" | ≤2 decimals | admin refunds at/above wait for a second staff (control) |
| failedBooking.mode / defaultChoice / choiceWindowHours / walletIncentivePercent | | ORIGINAL_METHOD / WALLET / 24 / null | modes CUSTOMER_CHOICE, ORIGINAL_METHOD, WALLET; 1–168 h; 0–20 % | airline refused after payment |
| offlineSettlement.approvalRequired / approvalThresholdUsd | bool / money | true / 500 | | cash / transfer refunds (two-person) |
| allowWalletTopup | boolean | true | | card top-ups |
| walletTopUp.minUsd / maxUsd / dailyMaxUsd | money | 5 / 5000 / 10000 | min ≤ max ≤ daily | top-up limits |
| walletTopUp.requireVerifiedEmail / minAccountAgeHours / newAccountDays / newAccountMaxUsd / newAccountDailyMaxUsd / newAccountTotalMaxUsd / maxTopUpsPerDay | | true / 0 / 7 / 500 / 500 / 1000 / 5 | | 7C new-account risk (controls) |
| walletFunds.spendOrder | ordered list | PROMO, LOYALTY, COMPENSATION, CARD_REFUND, CASH | each class once | which wallet money is spent first (control) |

Sub-sections: **Refund destination** · **Automation & timing** · **Approvals** (approvalThresholdUsd,
offlineSettlement) · **Failed bookings** · **Wallet top-ups** · **Wallet money order**.

Missing: S-16 `walletFunds.promoExpiryDays` (int?, null) — PROMO / COMPENSATION credit never expires today. P2 [backend].

Overlaps: the group description says "Refund destination, wallet incentives and automatic refunds" but 40 % of the
fields are wallet rules. Recommend a **Wallet** view that gathers `refund_policy.allowWalletTopup`, `walletTopUp.*`,
`walletFunds.*`, `payment_methods.walletPayments.*`, `agent_payment_policy.walletOnBehalf*` and
`platform.features.wallet` (UI first; a backend split into a `wallet` group is P2). `approvalThresholdUsd` is a decimal
string while every other USD amount is a number → the UI must render it as money anyway.

### 3.3 Special page: Payment gateways (`org-payment-gateways`) · owner only

Purpose: keys per gateway account (encrypted, win over `.env`, apply at once), test vs live detection, webhook URL to
paste, test connection, remove saved keys. Permission `payments.gateway_credentials`, recent sign-in.

| Gateway | Fields (secret = write-only, shows ••••last4) |
|---|---|
| STRIPE | secretKey (secret), publishableKey, webhookSecret (secret) |
| MYFATOORAH | apiKey (secret), webhookSecret (secret), baseUrl (test, live, live_sa, live_qa, live_eg) |
| PAYMOB | apiKey (secret), hmacSecret (secret), publicKey, baseUrl (live_eg, live_sa, live_ae, live_om) |
| MOYASAR | secretKey (secret), webhookSecret (secret), baseUrl |
| TAP | secretKey (secret), webhookSecret (secret), baseUrl |
| PAYTR | merchantId, merchantKey (secret), merchantSalt (secret), testMode, fallbackIp, maxInstallment 1–12, baseUrl |
| IYZICO | apiKey (secret), secretKey (secret), maxInstallment, baseUrl (test, live) |

States shown: source (saved here / .env / none), mode (test/live/unknown), active vs reason (excluded by
`PAYMENT_PROVIDERS`, fake, deploy-mode mismatch, unreadable). Missing: none; the redesign should show each gateway's
`payment_methods` on/off next to its keys (one place answers "can customers pay with X?").

### 3.4 `disputes` — Payment disputes (نزاعات الدفع) · v2 · money controls

Purpose: chargeback deadlines and reminder, and what an open/lost dispute freezes or takes back.

| Key | Type | Default | Range | Controls |
|---|---|---|---|---|
| reminderHoursBeforeDue | hours | 48 | 1–336 | "dispute due soon" alert |
| defaultEvidenceDays | days | 7 | 1–60 | deadline when the gateway gives none |
| freezeWalletOnOpen | boolean | true | | (control) |
| freezePointsOnOpen | boolean | true | | (control) |
| reversePointsOnLost | boolean | true | | (control) |
| debitWalletOnLostTopUp | boolean | false | | **moves customer money** (control, high risk) |

Sub-sections: **Deadlines** · **While a dispute is open** · **When a dispute is lost**. Missing: none.

### 3.5 `fraud_policy` — Fraud protection (الحماية من الاحتيال) · v3 · all security controls

Purpose: risk score and review before ticketing, scoring rules, 3-D Secure policy, card-testing guard.

| Key | Type | Default | Range / options | Controls |
|---|---|---|---|---|
| review.enabled / reviewScore / reminderMinutes | bool / int / min | true / 60 / 60 | 1–1000; 0–10080 | hold before ticket |
| rules.cardSharedAcrossAccounts | enabled, maxAccounts, windowHours, score | on, 2, 24, 60 | | stolen card resold |
| rules.cardsPerAccount | enabled, maxCards, windowHours, score | on, 3, 24, 40 | | |
| rules.accountsPerDevice | enabled, maxAccounts, windowHours, score | on, 3, 24, 40 | | X-Device-Id |
| rules.paymentsPerIp | enabled, maxPayments, windowHours, score | on, 5, 1, 30 | | |
| rules.countryMismatch | enabled, score | on, 25 | | IP / card / phone country |
| rules.sameDayTravel | enabled, withinHours, score | on, 24, 30 | | |
| rules.highAmount | enabled, amountUsd, score | on, 1000, 30 | | |
| rules.noLiabilityShift | enabled, score | on, 30 | | 3DS without shift |
| threeDs.mode / aboveUsd / riskScore | enum / money / int | RISK_BASED / 300 / 30 | ALWAYS, ABOVE_AMOUNT, RISK_BASED | |
| cardTesting.enabled / maxDeclinesPerSession / maxDeclinesPerAccount / accountWindowHours / maxDeclinesPerIp / ipWindowMinutes / blockMinutes / waveDeclines / waveWindowMinutes | | true / 3 / 5 / 24 / 10 / 60 / 60 / 30 / 10 | | card testing |

Sub-sections: **Risk review** · **Scoring rules** (one row per rule: switch, threshold, window, score) · **3-D Secure** ·
**Card testing**.

Missing:

| Id | Key | Type | Default | Why | Pri |
|---|---|---|---|---|---|
| S-14 | blocklist.emailDomains | string list | [] | Ops cannot block a known fraud domain without a deploy; there is no manual block list anywhere (only the admin IP allow-list). | P1 [backend: checkout + top-up check] |
| S-15 | blocklist.cardIssuerCountries | multi-enum (ISO-2) | [] | Refuse or force review for cards issued in chosen countries (score rules only look at mismatches). | P1 [backend] |

### 3.6 `accounting_access` — What the accountant sees (ما يراه المحاسب) · v2 · security control

Purpose: per field, visible / masked / removed for holders of `invoicing.export` without `users.reveal_pii`.

| Key | Type | Default | Options |
|---|---|---|---|
| fields.buyerName / buyerCompany / buyerAddress / customerName / customerId / gatewayPaymentId | enum | visible | visible, masked, removed |
| fields.buyerEmail / buyerTaxId / customerEmail | enum | masked | |

Sub-sections: **Invoices (buyer)** · **Payments (customer)** · **Gateway references**. Missing: none.
Recommendation: move to the Finance section (it is about the finance exports, not customer payments).

### 3.7 `money_check` — Daily money check (فحص الأموال اليومي) · v1

Purpose: the 05:15 UTC job comparing money tables; thresholds of "stuck" money; run retention.

| Key | Type | Default | Range |
|---|---|---|---|
| enabled | boolean | true | master switch of the scheduled run |
| sampleSize | int | 50 | 1–500 |
| refundOpenHours / refundFailedHours / reviewOpenHours / unappliedPaymentHours / walletHoldHours | hours | 24 each | 1–720 |
| documentGraceMinutes | minutes | 60 | 5–1440 |
| auditLookbackDays | days | 35 | 1–365 |
| keepRunsDays | days | 400 | 30–3650 |

Sub-sections: **Run** (enabled, sampleSize) · **Stuck-money thresholds** · **Documents & audit** · **Retention**.
Missing: none. Move to Finance section.

### 3.8 `finance_ledger` — Finance ledger (دفتر الحسابات) · v1

Purpose: the double-entry ledger in SHADOW mode, its daily close, alert threshold and retries.

| Key | Type | Default | Range |
|---|---|---|---|
| enabled | boolean | true | records ledger entries |
| dailyCloseEnabled | boolean | true | 05:45 UTC close |
| differenceThresholdUsd | money | 1 | 0–10 000 |
| failureAlertMinutes | minutes | 15 | 5–1440 |
| maxAttempts | int | 10 | 1–50 |
| catchUpDays | days | 3 | 1–60 |
| keepRunsDays | days | 400 | 30–3650 |

Sub-sections: **Recording** · **Daily close** · **Failed postings** · **Retention**.
Missing: S-22 `lockedThroughDate` (date?, null) — accounting period lock so nothing posts into a closed month (no
period lock found). P2 [backend]. Move to Finance section.

## 4. Section: Pricing & tax (`pricing`)

### 4.1 `tax` — Tax (الضريبة) · v2

Purpose: seller legal entity, tax mode, tax-inclusive prices, document numbering, service-fee line. Rates live in the
`tax_rates` table (`/finance/taxes`).

| Key | Type | Default | Range / options |
|---|---|---|---|
| legalEntity.name | string | Goteav | 1–200 |
| legalEntity.country | ISO-2? | null | required in VAT |
| legalEntity.taxId | string? | null | VKN / VAT / TRN, required in VAT |
| legalEntity.address | text | "" | ≤500 |
| legalEntity.email | email or "" | "" | |
| mode | enum | NONE | NONE, VAT (accountant only) |
| pricesIncludeTax | boolean | true | |
| numbering.receiptPrefix / invoicePrefix / creditNotePrefix / refundReceiptPrefix | string | RCPT / INV / CN / RFND | A–Z0–9 ≤10, unique; change restarts at 1 |
| numbering.yearlyReset | boolean | true | |
| showServiceFeeLine | boolean | false | |

Sub-sections: **Seller (legal entity)** · **Tax mode** · **Document numbering** · **Invoice lines**.

Missing: S-19 `documentFooter` (localized text?, null) — bank details / legal mentions printed on receipts and
invoices. P2 [backend]. Pending owner/accountant answer (memory, 2026-11-04): foreign invoice buyers — not proposed
here.

### 4.2 `e_invoicing` — E-invoicing (الفوترة الإلكترونية) · v1

Purpose: Turkish e-documents (e-Fatura / e-Arşiv): switch, seller tax office, profile, cancellation windows, retries.

| Key | Type | Default | Range / options |
|---|---|---|---|
| enabled | boolean | true | send an e-document per issued document |
| sellerTaxOffice | string | "" | ≤100 (vergi dairesi) |
| eFaturaProfile | enum | TEMELFATURA | TEMELFATURA, TICARIFATURA |
| cancellation.onFullRefund | boolean | true | |
| cancellation.eArsivWindowDays | days | 7 | 0–31 |
| cancellation.eFaturaCancellable | boolean | false | |
| cancellation.eFaturaWindowDays | days | 8 | 0–31 |
| retry.maxAttempts / baseDelaySeconds | int / s | 8 / 30 | 1–20 / 1–3600 |
| statusPollMinutes | minutes | 15 | 1–1440 |

Sub-sections: **Switch & seller** · **Profile** · **Cancellation windows** · **Delivery & retries**.

Missing: S-20 `provider` (read-only status: none / fake / ozel_entegrator) — the real switch is the env
`E_INVOICING_PROVIDER` (`none` in production until the Özel Entegratör is chosen), so `enabled = true` today sends
nothing and the page does not say so. P1 [backend exposes the bound provider]. Overlap: the VKN is
`tax.legalEntity.taxId` → show it read-only here next to the tax office.

### 4.3 `fx` — Exchange rates (أسعار الصرف) · v2

Purpose: rate provider, refresh cadence, default safety margin, staleness and rounding.

| Key | Type | Default | Range / options |
|---|---|---|---|
| baseCurrency | literal | USD | fixed |
| provider | enum | frankfurter | frankfurter, openexchangerates, fake |
| refreshIntervalMinutes | minutes | 60 | |
| safetyMarginPercent | % | 1.5 | per-currency override in the currencies table |
| staleAfterMinutes | minutes | 1440 | stale → pricing fails + ops alert |
| rounding.mode | enum | ceil | ceil, half_up, floor |

Sub-sections: **Source & refresh** · **Margin & rounding**.

Missing: S-21 `outlierPercent` (%, 5) — the refresh flow's outlier threshold is a constant. P2 [backend].
Overlap: `provider` is shadowed by the env `FX_PROVIDER` ("environment wins over the `fx.provider` setting",
`fx-provider.factory.ts`) → show the provider in force, read-only, or drop the field (P2 backend).

### 4.4 `markup_rules` — Markup rules (قواعد الهامش) · v1 (+ hidden `pricing`)

Purpose: markup on supplier prices: a default action plus prioritised rules (scopes FLIGHT_OFFER, FLIGHT_SERVICE,
FLIGHT_CHANGE, HOTEL_RATE).

| Key | Type | Default | Range / options |
|---|---|---|---|
| defaultRule.mode | enum | percentage | percentage, fixed, both |
| defaultRule.percent | % | 5 | 0–100 |
| defaultRule.fixedUsd | money | 0 | |
| defaultRule.minUsd / maxUsd | money? | 0 / null | min ≤ max |
| defaultRule.roundTo | number | 0.01 | >0–1000 |
| rules[] | rule DSL | [] | first match wins; validFrom/validTo |
| *(pricing)* rulesSource | enum | settings | settings, table (control) |

Sub-sections: **Default markup** · **Rules** · **Rules source** (from `pricing`).

Overlap / recommendation: `pricing` (1 field, control) is registered but not shown; it decides whether this group
prices at all (`table` makes `PUT markup_rules` answer 409 `settings.group_retired`). Show it as the first
sub-section of Markup rules with its shadow-period warning; retire it once the table is the source. Missing: none.

## 5. Section: Staff (`staff`)

### 5.1 `agent_booking_policy` — Agent booking approvals · v2 · money controls (manual payment = two-person)

| Key | Type | Default | Range |
|---|---|---|---|
| priceAdjustApprovalRequired | boolean | true | staff price adjustments wait |
| maxAdjustPercentWithoutApproval | % | 0 | 0–100 |
| manualPaymentApprovalRequired | boolean | true | cash / transfer |
| manualPaymentApprovalThresholdUsd | money | 500 | 0–1 000 000 |

Sub-sections: **Price adjustments** · **Manual payments**. Missing: S-18 `maxAdjustPercent` (%, 30) — absolute cap on
any staff adjustment even with approval. P2 [backend].

### 5.2 `agent_payment_policy` — Agent payment limits · v1 · wallet limits are money controls

| Key | Type | Default | Range |
|---|---|---|---|
| paymentLinkMinMinutes | minutes | 30 | 5–1440 |
| manualApprovalHoldMinutes | minutes | 60 | 0–10080 |
| walletOnBehalfDailyCapUsd | money | 2000 | per staff per UTC day |
| walletOnBehalfApprovalThresholdUsd | money | 500 | |

Sub-sections: **Payment links & price holds** · **Wallet on behalf**. Missing: S-17 `walletCreditMaxUsd` (money?,
null) — cap of one staff goodwill (COMPENSATION) credit; every credit already waits for a second staff member. P2
[backend].

### 5.3 `post_booking_services_policy` — Post-booking extras · v1 · controls except customerCanCancel

| Key | Type | Default | Range |
|---|---|---|---|
| staffAddEnabled | boolean | true | staff path as a whole |
| paymentLinkEnabled / walletOnBehalfEnabled / manualPaymentEnabled | boolean | true | how staff collect |
| staffQuoteMinutes | minutes | 30 | 15–1440 |
| customerCanCancel | boolean | true | |

Sub-sections: **Staff path** · **Collection methods** · **Quotes**. Missing: none.

Overlap: three switches decide extras after booking: `flight_provider.postBookingEnabled` (all post-booking
operations), `flight_provider.postBookingServicesEnabled` (extras at all) and this `staffAddEnabled` (the staff path)
→ show the chain ("off above = this does nothing") on both pages.

Approvals overview (cross-group): the four-eyes thresholds live in five groups (`refund_policy.approvalThresholdUsd`,
`refund_policy.offlineSettlement`, `agent_booking_policy.*`, `agent_payment_policy.walletOnBehalfApprovalThresholdUsd`,
`loyalty.manualGrant*`). Recommend an "Approvals" summary card in the Staff section that lists them with links.

## 6. Section: Flights (`flights`)

### 6.1 `flights` — Flights (الطيران) · v4

Purpose: customer-facing checkout timings, price tolerance, airline-initiated changes, search limits, fare calendar.

| Key | Type | Default | Range / options |
|---|---|---|---|
| priceLockMinutes | minutes | 15 | |
| checkoutTtlMinutes | minutes | 30 | |
| priceChangeToleranceUsd | money | 5 | absorbed increase at final re-price |
| autoAcceptMinorAic | boolean | true | |
| minorAicThresholdMinutes | minutes | 60 | |
| maxPassengers | int | 9 | 1–9 |
| maxInfantsPerAdult | int | 1 | 0–1 |
| allowedCabinClasses | multi-enum | all four | ECONOMY, PREMIUM_ECONOMY, BUSINESS, FIRST |
| searchResultsLimit | int | 200 | 10–500 |
| fareCalendar.enabled / reuseIdenticalSearches | boolean | true / true | |
| fareCalendar.freshnessSeconds | seconds | 600 | 60–1800 |
| fareCalendar.liveProbeDays | days | 3 | 0–7 |
| fareCalendar.maxProbesPerMinute / probesPerVisitor | int | 60 / 14 | 0–600 / 0–100 |
| fareCalendar.probeWindowMinutes | minutes | 10 | 1–60 |
| fareCalendar.recentMaxAgeHours | hours | 6 | 1–48 |

Sub-sections: **Checkout timings** · **Price changes** · **Schedule changes** · **Search** · **Fare calendar** (labels
missing in the dictionary).

Missing:

| Id | Key | Type | Default | Why | Pri |
|---|---|---|---|---|---|
| S-23 | bookingCutoffMinutes | minutes | 120 | No lead-time guard: a customer can pay for a flight leaving in 40 minutes and the ticket may never be issued (fraud only adds a score for same-day travel). | P1 [backend] |
| S-24 | maxDaysAhead | days | 330 | Search window cap (airlines publish ~11 months). | P2 [backend] |

### 6.2 `flight_provider` — Flight supplier (مورّد الطيران) · v6

Purpose: everything about selling the supplier (Duffel): kill switches, timeouts, circuit breaker, coverage, hold /
pre-charge hold / cancellation / change policies (rule DSL), capability toggles, failed services, confirmation
safety, reconciliation, webhooks, ranking. About 75 leaves: the group that most needs sub-sections.

| Key | Type | Default | Range / options |
|---|---|---|---|
| searchEnabled / bookingEnabled / postBookingEnabled | boolean | true | kill switches |
| searchDisabledMessage / bookingDisabledMessage | localized? | null | |
| supplierTimeoutMs | ms | 15 000 | 2 000–60 000 |
| supplierTimeouts.priceMs | ms | 8 000 | |
| defaultMaxConnections | int? | null | 0–2 |
| circuitBreaker.enabled / failureThreshold / windowSeconds / openSeconds / halfOpenMaxCalls | | true / 5 / 60 / 30 / 1 | |
| circuitBreaker.countTimeouts / countServerErrors / countRateLimits | boolean | true / true / false | |
| excludedAirlines / allowedAirlines | IATA list | [] | ≤500 |
| excludedRoutes | {origin,destination} list | [] | `*` wildcard |
| allowedOriginCountries / allowedDestinationCountries | ISO-2 list | [] | |
| holdPolicy.enabled / maxHoldHours / requireVerifiedPhone / requireAuthenticatedUser / maxActiveHoldsPerUser / autoCancelOnExpiry / paymentCutoffMinutes / reminderOffsetsHours / servicesOnHold / bagsWithHold / default / rules | | true / 72 / true / true / 3 / true / 30 / [24,6,1] / false / true / allow / [] | |
| preChargeHold.enabled / default / rules / channels / onIncompatibleServices / onHoldRefused / holdTimeoutMs / minGuaranteeMinutes | | false / allow / [] / [WEB, ADMIN] / holdThenSell / refuse / 30 000 / 15 | silent hold before charge |
| cancellationPolicy.feeUsd / feePercent / refundMarkupOnCancel / refundFxMarginOnCancel / default / rules | | 15 / 5 / false / false / allow / [] | D1: larger of $15 and 5 % |
| cancellationPolicy.voidWindow.mode / safetyMarginMinutes | enum / min | FULL_REFUND / 60 | FULL_REFUND, FEE_WAIVED, STANDARD |
| changePolicy.feeUsd / default / rules | | 0 / allow / [] | |
| upsellEnabled, postBookingServicesEnabled, finalPricingBeforeOrder, multiStepSearchEnabled, progressiveSearchEnabled | boolean | false, true, true, false, false | |
| progressiveDrainSeconds | seconds | 20 | 1–300 |
| syncLoyaltyToOffer | enum | off | off, soft, strict |
| advancedFilters.arrivalWindows / fareTypes / youngAdult | | false / [] / false | |
| privateFares | map IATA → codes | {} | corporate code / tracking ref |
| splitTicketEnabled, sendDeviceHeaders, metadataSync, mealsEnabled, cfarEnabled | boolean | false | |
| orderListReconcile.enabled / everyMinutes / autoCancelOrphanHolds | | true / 60 / true | |
| ticketingAlert.enabled / afterHours / everyMinutes / departureShare / minWaitMinutes / criticalWithinHours | | true / 6 / 60 / 0.25 / 30 / 24 | |
| failedServicesPolicy.enabled / notifyCustomer / alertStaff / allowCustomerChoice / refundRequiresAdminConfirmation / autoRefundEnabled / autoRefundAfterHours | | true / true / true / true / false / true / 24 | |
| confirmationSafety.retryWindowMinutes / stuckAfterMinutes / alertAfterRedrives / autoCancelOrphanOrders | | 30 / 5 / 3 / true | |
| webhookEvents | list | 13 Duffel v2 events | |
| balanceAlertUsdPerDay | money? | null | |
| preferredAirlines | {iata, boost} list | [] | |
| resultsRankingWeights.price / duration / stops / preferredAirline | 0–1 | 0.55 / 0.3 / 0.15 / 0 | sum = 1 |

Sub-sections (split the page into these): **Kill switches & messages** · **Supplier connection** (timeouts, breaker,
webhooks) · **Coverage** (airlines, routes, countries, private fares) · **Holds** (holdPolicy + preChargeHold) ·
**Cancellation & change** (incl. void window) · **Extras & capabilities** (upsell, post-booking, meals, CFAR, split
ticket, multi-step, progressive, loyalty sync, filters) · **After payment** (final pricing, confirmation safety,
failed services, ticketing alert, reconciliation) · **Ranking**.

Missing: none at field level. Overlaps: `balanceAlertUsdPerDay` duplicates `flight_guards.supplierBalance.lowBalanceUsd`
(the guard is the real, documented watch) → retire it (backend P2) and hide it now. `finalPricingBeforeOrder` uses
`flights.priceChangeToleranceUsd` (cross-link). Post-booking switch chain, see §5.3.

### 6.3 `flight_guards` — Supplier and cost guards (حراس المورد والكلفة) · v1

| Key | Type | Default | Range / options |
|---|---|---|---|
| supplierBalance.enabled | boolean | true | |
| supplierBalance.lastReading {amountUsd, at} | money + datetime? | null | finance enters it after each top-up |
| supplierBalance.lowBalanceUsd | money | 2000 | |
| supplierBalance.minCoverDays | days | 2 | 0–60 |
| supplierBalance.consumptionWindowDays | days | 7 | 1–90 |
| supplierBalance.pauseConfirmationWhenInsufficient | boolean | true | |
| supplierBalance.pauseMaxMinutes | minutes | 240 | 10–720 |
| searchGuard.perIpDailySearches / perAccountDailySearches | int? | 500 / 500 | |
| searchGuard.dailySupplierSearchBudget / lookToBookAlertRatio | int? | null / null | |
| searchGuard.captcha.enabled / guestSearchesBeforeChallenge / passMinutes | | false / 30 / 60 | |
| searchCoalescing.enabled / scope | bool / enum | true / visitor | visitor, everyone |
| duplicateBooking.policy | enum | warn | off, warn, block |
| holdAbuse.abandonmentWindowDays / maxExpiredUnpaidInWindow / cooldownDays / maxHeldSeatsPerFlight | | 30 / 3 / 7 / null | |

Sub-sections: **Supplier balance** · **Search budgets & CAPTCHA** · **Shared searches** · **Duplicate bookings** ·
**Hold abuse**. Missing: none.

### 6.4 Hotels (planned)

S-25 `hotel_provider` group (search/booking kill switches, supplier timeouts, hold and cancellation policies, coverage)
— `flight_provider` explicitly says a second product gets its own `<product>_provider` group; markup already has the
`HOTEL_RATE` scope and `platform.features.hotels` exists. P2 [backend; after design doc 20].

## 7. Section: System & data (`system`)

### 7.1 `notifications` — Notifications (الإشعارات) · v7 · ops alerts are security controls

Purpose: channels per customer event, provider switches, legacy admin alerts, ops alerts (routing, Telegram, on-call,
webhook, throttle), e-mail content and delivery retries.

| Key | Type | Default | Range / options |
|---|---|---|---|
| events.<templateKey> | channel toggles | 36 events (identity ×12, bookings ×6, flights ×11, payments ×4, loyalty ×2, ops.alert) | EMAIL, WHATSAPP, SMS, PUSH |
| providers.email.enabled / fromName / replyTo | | true / Goteav / null | |
| providers.whatsapp.enabled | boolean | true | also on the WhatsApp page |
| providers.whatsapp.pacing.perMinute / jitterPercent | int | 20 / 40 | 1–600 / 0–100 |
| providers.sms.enabled | boolean | false | needs an SMS provider |
| providers.push.enabled | boolean | true | silent until `FCM_SERVICE_ACCOUNT_JSON` |
| adminAlerts.enabled / emails / whatsappNumbers / events | | true / [] / [] / 7 events | legacy |
| opsAlerts.enabled / recipients / minSeverity / channels | | true / [] / warning / all four | info, warning, high, critical; EMAIL, WHATSAPP, TELEGRAM, ONCALL |
| opsAlerts.routing.EMAIL / WHATSAPP / TELEGRAM / ONCALL | enum | info / critical / high / critical | |
| opsAlerts.telegramChatIds | list | [] | ≤10 |
| opsAlerts.webhookUrl | public https? | null | |
| opsAlerts.throttleMinutes / burstLimit | int | 15 / 10 | ≤1440 / 1–500 |
| emailContent.showFareRules | boolean | true | |
| delivery.maxAttempts / retryBackoffSeconds / staleAfterSeconds | | 5 / 60 / 600 | |

Sub-sections: **Channels** (providers) · **Customer messages** (event × channel matrix, grouped by account,
bookings, flights, payments, loyalty) · **Ops alerts** (recipients, severity routing, Telegram, on-call, webhook,
storm guard) · **E-mail content** · **Delivery & retries** · *(Legacy admin alerts, collapsed)*.

Missing:

| Id | Key | Type | Default | Why | Pri |
|---|---|---|---|---|---|
| S-26 | quietHours.enabled / start / end / channels | bool / "HH:mm" / "HH:mm" / multi-enum | false / 22:00 / 08:00 / [WHATSAPP, PUSH] | Non-urgent WhatsApp/push at 3 a.m. hurts the number's reputation and the customer; codes, booking outcome and ops alerts would never be held. No quiet hours exist. | P1 [backend: delivery scheduler, platform time zone] |
| S-27 | copies.bookingConfirmationBcc | e-mail list | [] | An ops mailbox copy of confirmations / tickets for the agent desk. | P2 [backend] |

Overlaps: `adminAlerts` is the older staff alert list; `opsAlerts` is the incident channel (the controls file says
so) → hide `adminAlerts` behind "Legacy" and retire it in the backend (P2). `providers.whatsapp.enabled` is also the
WhatsApp page switch (same field, keep both views in sync). `SMS_PROVIDER` is `none | fake`: `providers.sms.enabled`,
the SMS column of the matrix (`payments.payment_link` ships with SMS on) and `phoneOtpChannel = SMS` are inert →
the page must say "no SMS provider connected".

### 7.2 Special page: WhatsApp (Cartat) (`org-whatsapp-provider`)

Purpose: status (provider, connection state, last success / failure, last webhook event), the WhatsApp on/off switch
(`notifications.providers.whatsapp.enabled`), Cartat account (API URL, API token secret; owner only
`settings.provider_credentials`, recent sign-in), delivery receipts webhook (switch, URL, secret, rotate), test
message (phone, locale; 5 per 10 min). Pacing is shown read-only with a link to Notifications.

Missing: none. Recommendation: make pacing editable here too (it is the WhatsApp-specific setting), or keep the link
but show the "number ban" rationale on both.

### 7.3 `mobile_app` — Mobile app (تطبيق الموبايل) · v2 · fully public

| Key | Type | Default | Range |
|---|---|---|---|
| ios.minSupportedVersion / latestVersion / storeUrl | x.y.z? / x.y.z? / https? | null | force / optional update |
| android.minSupportedVersion / latestVersion / storeUrl | | null | |
| updateMessage | localized? | null | |
| identifiers.iosBundleId / appleTeamId / androidPackage | string? | null | Team ID 10 chars |
| identifiers.androidSha256Fingerprints / googleClientIds | lists | [] | ≤10 |
| links.universalLinkBase / appPathPrefix | https? / path | null / `/app` | |

Sub-sections: **iOS release** · **Android release** · **Update prompt** · **Identifiers** · **App links**. Missing: none.

### 7.4 `analytics` — Analytics (التحليلات) · v1

| Key | Type | Default |
|---|---|---|
| retention.providerCallDays / searchSummaryDays / searchOfferDays / funnelEventDays / orderFactDays / dailyStatDays / batchSize | days | 365 / 365 / 180 / 180 / 1095 / 1825 / 5000 |
| live.enabled / intervalSeconds / heartbeatSeconds / maxClients / maxDurationMinutes / minuteRetentionHours / hourRetentionDays / activeHoldsCacheSeconds | | true / 5 / 15 / 10 / 60 / 3 / 7 / 10 |
| capabilities.minObservations / supportedShare / unsupportedShare / matrixCacheSeconds | | 20 / 0.8 / 0.2 / 60 |
| sink.enabled / flushIntervalMs / flushRows / maxBufferedRows | | true / 1000 / 200 / 5000 |
| reports.minGroupSize / statementTimeoutMs | | 5 / 15 000 |

Sub-sections: **Retention** · **Live stream** · **Airline capabilities** · **Telemetry sink** · **Reports**. Almost all
of it is engineering tuning → show under an "Advanced" disclosure, owner-facing items first (retention, k-anonymity).

### 7.5 `audit` — Audit log (سجلّ التدقيق) · v1

| Key | Type | Default | Range |
|---|---|---|---|
| retentionDays | days | 730 | 30–3650 |
| activityRetentionDays | days | 365 | 30–3650 |
| batchSize / maxBatches | int | 5000 / 200 | |

### 7.6 `storage` — File storage (تخزين الملفات) · v3

| Key | Type | Default | Range |
|---|---|---|---|
| trash.retentionDays | days | 30 | 1–365 |
| trash.batchSize | int | 200 | 1–5000 |

### 7.7 `retention` — Data retention (مدد الاحتفاظ بالبيانات) · v2

| Key | Type | Default | Range |
|---|---|---|---|
| enabled | boolean | true | master switch of the nightly sweep |
| outboxDeliveredDays / processedEventDays | days | 30 / 30 | ≥7 |
| webhookEventDays / notificationDays / flightSearchLogDays | days | 90 / 180 / 180 | ≥30 |
| staffInboxDays / clientErrorDays | days | 90 / 90 | ≥30 / ≥7 |
| clientErrorMaxRows | int | 5000 | 100–100 000 |
| batchSize | int | 5000 | 100–50 000 |

Overlap (7.4–7.7 and more): retention windows are spread over **eight** groups: `retention`, `analytics.retention`,
`audit`, `storage.trash`, `security.loginHistory`, `money_check.keepRunsDays`, `finance_ledger.keepRunsDays`,
`account.export.linkTtlDays`. Keep the groups (each context owns its tables) but add a **Data retention overview**
(F-08): one table "what is kept, how long, where to change it", with deep links (`?focus=<path>` already works).

---

## 8. Personal preferences (this browser)

Stored in `localStorage` (`dashboard-settings`, zustand v2), applied at once.

### 8.1 Appearance

| Key | Type | Default | Options |
|---|---|---|---|
| theme | enum | light | light, dark (store also accepts `system`, the UI does not offer it) |
| colorTheme | enum | teal | teal, emerald, blue, rose, violet, orange, indigo, custom |
| customColor / savedColors | hex / list | "" / [] | colour picker, saved swatches |
| sidebarCustomBg / sidebarBgColor | bool / hex | false / #1e293b | independent sidebar colour |
| layoutStyle | enum | floating | modern, classic, floating |
| layout | enum | default | default, compact, no-sidebar |
| language | enum | (route locale) | ar, en |
| fontFamily | enum | Cairo | Cairo, IBM Plex Sans Arabic, Noto Sans Arabic, Tajawal |
| fontSize | enum | base | sm 14px, base 16px, lg 18px, xl 20px |

Stored but not editable on the tab: `sidebarPosition` (right), `sidebarCollapsed`, `tableSettings.skin`.

### 8.2 Tables

| Key | Type | Default | Options |
|---|---|---|---|
| tableSettings.density | enum | standard | comfortable, standard, compact |
| tableSettings.pageSize | enum | 10 | 5, 10, 25, 50 |
| tableSettings.striped / showColumnVisibility / showColumnResize / showRowSelection / showGlobalFilter | boolean | false / true / true / true / true | read by the data grid |

### 8.3 Notifications

| Key | Type | Default | Notes |
|---|---|---|---|
| notifications.email / push / inApp / sound | boolean | true / true / true / false | **not read anywhere** (no consumer outside the tab) |

Overlap: the notifications page sidebar keeps a second set, `notifPrefs` (email, push, inApp + categories approvals,
payments, flights, support, system), also browser-only and also not used to filter or deliver anything. Two stores,
neither enforced.

Missing (preferences):

| Id | Key | Type | Default | Why | Pri |
|---|---|---|---|---|---|
| S-28 | theme = system | enum option | – | The store supports it; the tab offers light/dark only. | P1 (frontend only) |
| S-29 | staff notification preferences on the server | behaviour | – | Merge the two sets into one, keyed by the staff inbox categories, and store them per staff member so e-mail / push actually follow them. | P1 [backend] |
| S-30 | timeZone / digits | enum | Asia/Riyadh / latn | Personal display time zone and numerals (Latin vs Arabic-Indic); today Riyadh is hard-coded in the date-time fields. | P2 (frontend) |

Page-level for preferences: the store already has `resetSettings` (used by the quick widget), `exportSettings` and
`importSettings` (not in any UI) → expose reset / export / import on the preferences page (frontend only, P2).

---

## 9. Cross-cutting

### 9.1 Section map (recommendation)

Today: access 6 · customers 2 · payments 7 · pricing 4 · staff 3 · flights 3 · system 6 (+ 2 special). Problems:
`payments` mixes customer payments with finance back-office (7 groups); `account` sits in access; `maintenance` and
`pricing` are missing. Recommended re-cut into **8 sections**, every group exactly once:

| Section | Groups (order) | Count |
|---|---|---|
| Platform & access | platform, maintenance, security, verification_policy, abuse_protection, security_alerts | 6 |
| Customers | account, travellers, loyalty | 3 |
| Payments & wallet | payment_methods, *payment gateways*, refund_policy, fraud_policy, disputes | 4 + 1 |
| Pricing & tax | markup_rules (+ pricing as a sub-section), fx, tax, e_invoicing | 4 |
| Finance controls | finance_ledger, money_check, accounting_access | 3 |
| Staff desk | agent_booking_policy, agent_payment_policy, post_booking_services_policy | 3 |
| Flights | flights, flight_provider, flight_guards | 3 |
| System & data | notifications, *WhatsApp (Cartat)*, mobile_app, analytics, audit, storage, retention | 6 + 1 |

If the owner wants to stay at 7: merge "Finance controls" into "Pricing & tax" as "Tax & finance" (7 groups), keeping
markup_rules + fx there too. The mock follows the 8-section cut.

### 9.2 Overlaps and duplication (summary)

| # | Where | Finding | Recommendation |
|---|---|---|---|
| O-1 | security / security_alerts / abuse_protection / verification_policy | Four groups touch sign-in; `adminTotpRequired` (staff) sits in customer verification | Keep groups (owners differ); present Staff access vs Customer sign-in sub-sections; move adminTotpRequired to Security view |
| O-2 | payment_methods ↔ payment gateways page | On/off and methods in one place, keys in another | Show key status on gateway cards and on/off on the keys page; `credentialsRef` advanced read-only |
| O-3 | refund_policy ↔ payment_methods.walletPayments ↔ agent_payment_policy ↔ platform.features.wallet | Wallet rules scattered; refund_policy is 40 % wallet | Wallet view in the UI now; backend `wallet` group later (P2) |
| O-4 | flights / flight_provider / flight_guards | Split is customer-facing / supplier control / cost guards (sound) but undocumented | Explain the split in each header; cross-link tolerance ↔ final pricing |
| O-5 | flight_provider.balanceAlertUsdPerDay ↔ flight_guards.supplierBalance.lowBalanceUsd | Two low-balance alerts | Hide and retire the provider one |
| O-6 | flight_provider.postBookingEnabled / postBookingServicesEnabled ↔ post_booking_services_policy.staffAddEnabled | Three switches in a chain | Show the chain on both pages |
| O-7 | notifications.adminAlerts ↔ opsAlerts | Legacy list next to the incident channel | Collapse as Legacy; retire in backend |
| O-8 | notifications.providers.whatsapp.enabled ↔ WhatsApp page | Same switch in two places | Fine; one source, both views |
| O-9 | Retention in 8 groups | No single answer to "how long do we keep X" | Data retention overview (F-08) |
| O-10 | pricing (hidden) ↔ markup_rules | The switch that retires the group is invisible | Sub-section of Markup rules |
| O-11 | maintenance ↔ platform | New group not in dashboard; platform summary/dictionary still mention maintenance | Add group, fix texts |
| O-12 | fx.provider ↔ env FX_PROVIDER | Env wins: the field can lie | Show provider in force; drop field later |
| O-13 | e_invoicing.enabled ↔ env E_INVOICING_PROVIDER | "On" sends nothing while provider = none | Read-only provider status (S-20) |
| O-14 | SMS everywhere ↔ SMS_PROVIDER none/fake | SMS toggles inert | Disable with a reason |
| O-15 | Two CAPTCHAs (abuse_protection, flight_guards) | Same Turnstile key | Shared key status hint |
| O-16 | Approval thresholds in 5 groups | Four-eyes rules hard to review | Approvals summary card (Staff section) |
| O-17 | Personal notifications tab ↔ notifications sidebar `notifPrefs` | Two stores, neither enforced | Merge, then server-backed (S-29) |
| O-18 | platform.timezone (UTC) ↔ Riyadh-fixed date-time inputs | Two time references | Label inputs "Riyadh time" (already in chips) and align defaults |
| O-19 | verification_policy.phoneVerificationRequiredForBooking ↔ flight_provider.holdPolicy.requireVerifiedPhone | Booking vs hold scope | Explain in help text |

### 9.3 Page-level features

| Id | Feature | Today | Proposal | Pri |
|---|---|---|---|---|
| F-01 | Field-level search | Overview filter matches group name, code and description only | Search labels, help, keys and values of every field (Arabic + English), jump with `?focus=` | **P0** (frontend: schemas + dictionary) |
| F-02 | State on the overview | Version + date per card | Master switch on/off, attention, fields changed from default, last changed by, pending requests | **P0** (frontend; `changedById` → staff name lookup) |
| F-03 | Maintenance group | Missing | Sync API client, catalog entry, labels, status card | **P0** |
| F-04 | Reset to default | Default shown as a chip; no action | Per field, per sub-section and whole group, through the normal draft + review | P1 (frontend; defaults from `_schema`) |
| F-05 | History | Per group: version, date, reason, diff vs previous, rollback; actor not shown | Show who; compare any two versions; global "recent changes" feed | P1 (actor: frontend; feed: backend or audit log) |
| F-06 | Sub-sections | One section per top-level compound field + General | Curated sub-sections per group (this audit) | P1 (frontend catalog) |
| F-07 | Impact hints | A few group notes | Cross-links (O-4, O-6, O-16), "used by" chips, risk badges | P1 |
| F-08 | Data retention overview | – | Read-only table across 8 groups | P1 |
| F-09 | Diff before save | Exists (review dialog, raw JSON for nested values) | Labelled values, risk + approval marks per row | P1 |
| F-10 | Export / import | Not for organisation settings | Export all groups as JSON (frontend); import as per-group drafts through review and the control / approval rules | P2 (import needs backend checks) |
| F-11 | Change requests | Security groups + money-approval switches (queue `/team/security-requests`) | "Request change" for money controls too, for staff without `settings.write_controls` (today a lock) | P2 [backend] |
| F-12 | Scheduled changes | Only rule `validFrom/validTo` | "Apply at" for a version (e.g. markup change at midnight) | P2 [backend] |
| F-13 | Dictionary gaps | Raw English for maintenance, fare calendar, ops routing, retention v2, OTP fallback | Fill ar/en labels | P1 (frontend) |

### 9.4 All proposals by priority

| Pri | Id | Group | Key | Backend |
|---|---|---|---|---|
| P0 | S-01 | platform | legal.kvkkNoticeUrl | yes |
| P0 | S-02 | platform | company.tursabLicenseNo | yes |
| P0 | F-01 | page | field-level search | no |
| P0 | F-02 | page | state signals on overview | no |
| P0 | F-03 | page | maintenance group in the dashboard | client sync |
| P1 | S-03 | platform | legal.refundPolicyUrl | yes |
| P1 | S-04 | platform | legal.cookiePolicyUrl | yes |
| P1 | S-06 | security | adminSession.idleTimeoutMinutes | yes |
| P1 | S-07 | security | adminSession.maxSessionHours | yes |
| P1 | S-09 | account | deletion.walletBalancePolicy | yes |
| P1 | S-14 | fraud_policy | blocklist.emailDomains | yes |
| P1 | S-15 | fraud_policy | blocklist.cardIssuerCountries | yes |
| P1 | S-20 | e_invoicing | provider (read-only) | yes |
| P1 | S-23 | flights | bookingCutoffMinutes | yes |
| P1 | S-26 | notifications | quietHours.enabled / start / end / channels | yes |
| P1 | S-28 | preferences | theme: system | no |
| P1 | S-29 | preferences | server-backed staff notification preferences | yes |
| P1 | F-04…F-09, F-13 | page | reset, history, sub-sections, impact, retention overview, labelled diff, labels | mostly no |
| P2 | S-05 | platform | supportHours | yes |
| P2 | S-08 | security | passwordPolicy.staffMinLength | yes |
| P2 | S-10 | account | dormant.afterMonths | yes |
| P2 | S-11 | abuse_protection | signup.blockDisposableEmail | yes |
| P2 | S-12 | travellers | collectPassportAtBooking | yes |
| P2 | S-13 | loyalty | referral.enabled / bonusPoints | yes (new feature) |
| P2 | S-16 | refund_policy | walletFunds.promoExpiryDays | yes |
| P2 | S-17 | agent_payment_policy | walletCreditMaxUsd | yes |
| P2 | S-18 | agent_booking_policy | maxAdjustPercent | yes |
| P2 | S-19 | tax | documentFooter | yes |
| P2 | S-21 | fx | outlierPercent | yes |
| P2 | S-22 | finance_ledger | lockedThroughDate | yes |
| P2 | S-24 | flights | maxDaysAhead | yes |
| P2 | S-25 | (new) | hotel_provider group | yes |
| P2 | S-27 | notifications | copies.bookingConfirmationBcc | yes |
| P2 | S-30 | preferences | timeZone / digits | no |
| P2 | F-10…F-12 | page | export/import, money change requests, scheduled changes | yes |

The mock (`shared/mocks/settings/`) carries every P0 and P1 field proposal as `proposed: true` with its priority.

### 9.5 Uncertain

- S-02 (TÜRSAB) and S-01 (KVKK) depend on the company's licence and lawyer's advice; the code has neither.
- S-09: how account deletion treats a wallet balance or an upcoming trip was not traced in identity/wallet code.
- The personal notification preferences were checked for consumers by search only (`notifications.*`, `notifPrefs`):
  none found outside the settings tab and the notifications sidebar.
- The dashboard branch read was `feat/cartat-whatsapp`; the `maintenance` group may exist on another branch.
