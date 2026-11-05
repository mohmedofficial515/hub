---
app: web
page: email-booking-confirmed
route: "e-mail: bookings.confirmed (no web route)"
live-url:
sources:
  - backend/src/modules/notifications/infrastructure/templates/layouts/email.layout.hbs
  - backend/src/modules/notifications/infrastructure/templates/bookings.confirmed.html.hbs
  - backend/src/modules/notifications/infrastructure/templates/partials/
  - backend/src/modules/notifications/application/rendering/template-renderer.ts
  - backend/src/modules/flights/application/services/flight-notifications.ts
  - backend/src/i18n/{ar,en,tr}/emails.json
status: designing
---

# Booking confirmed e-mail (pilot for all Goteav e-mail)

## Purpose
The first message a traveller gets after paying: it must say at a glance that the trip is secured, carry the
airline code, and lead to the booking. It is the pilot: the chosen concept becomes the design of every e-mail.

## Inventory: 50 HTML e-mail templates, one shared layout, 6 partials
| Group | Count | Templates |
|---|---|---|
| identity | 20 | verify_email, welcome, otp, guest_otp, magic_link, password_reset, password_changed, login_alert, account_locked, account_secured, security_event, admin_totp_enrolled, staff_invitation, staff_temporary_password, email_change_confirm, email_change_notice, account_deletion_scheduled, account_deletion_paused, account_deleted, data_export_ready |
| flights | 11 | ticket_issued, hold_created, hold_reminder, hold_expired, change_confirmed, change_failed, airline_change_detected, schedule_change_notice, services_added, services_under_review, service_failed |
| bookings | 6 | confirmed, failed, cancelled, refund_issued, manage_otp, trip_reminder |
| payments | 4 | received, payment_link, refund_settled, refund_delayed |
| support | 3 | request_received, request_submitted, request_replied |
| loyalty | 2 | tier_changed, points_expiring |
| other | 4 | invoicing.document_issued, travellers.document_expiring, ops.alert, generic |

Every template renders into `layouts/email.layout.hbs` and shares the partials `greeting`, `button`, `code`,
`link_fallback`, `signature`, `trip_readiness_issue`. Changing the layout and partials restyles all 50 at once; only
templates that show trip facts need their body rewritten.

## Problems with the current template (seen in `v1-baseline`)
- Departure prints raw: `2026-12-05T10:30:00+03:00`. The `localTime` helper exists but this template does not use it.
- The logo is a `data:` URI. Gmail and Outlook do not display those, so the header loses its mark. Needs a hosted PNG.
- In Arabic the fact table is right-aligned as a block but its padding is written for LTR, so values float away from
  their labels, and passenger bullets sit on the far left.
- No visual hierarchy: reference, airline code, route and total look alike. No preheader. No dark mode.
- `#0b3d5c` in the header is not a Goteav colour (brand: teal `#089B9B`, navy `#1f325c`, ocean `#061b42`).

## Goals
- Say "confirmed" and show the route before any reading.
- Arabic first; correct in English; Turkish must fit on port.
- A design system that transfers to the other 49 templates through layout + partials.

## Constraints
- Tables and inline styles; `<style>` in head only for mobile and dark mode. Layout must survive those being stripped.
- No web fonts: Gmail and Outlook drop them, so the lab loads none and shows what most people will see.
- Everything readable with images off; solid colour behind every text-on-image.
- No coloured side or top stripes on cards (owner rule).
- White on `#089B9B` fails AA for normal text, so white-text buttons use the darker `#067a7a`.

## What any version needs on port (not done, lab only)
| Item | Why |
|---|---|
| Hosted logo PNGs (`logoOnDark`, `logoOnLight`) in the renderer context | replaces the `data:` URI |
| Helpers `clock`, `day`, `chars`; context `textStart`, `textEnd` | see `shared/email/render.ts`, marked NEW |
| Payload `outboundCity` | `destination` is the last slice's, which on a round trip is the home city. Check that `names` are city names, not airport names |
| Pass `firstName` for flight notifications | the flights module does not send it today, so these e-mails greet anonymously |
| New `emails.design.*` strings in `emails.json` for ar, en and tr | Turkish is not in the lab |
| Test in real clients (Gmail, Outlook desktop, Apple Mail) | the lab is Chrome; not yet tested in any real client |

## Testing in the lab
Each version has real `.hbs` files, rendered by a copy of the backend pipeline (`shared/email/`). The bar above the
e-mail switches scenario (`default`, `roundtrip`, `sparse`), images on/off, and shows size against Gmail's 102 KB clip.

## Versions
| Version | Idea | Status |
|---|---|---|
| v1-baseline | current production template | reference |
| v2-boarding-stub | a ticket with a tear line | draft |
| v3-flap-board | airport split-flap board, always dark | draft |
| v4-postcard | a postcard with stamp and postmark | draft |
| v5-trip-tracker | every e-mail is one stop on the trip's track | draft |
| v6-horizon | full-bleed sky with the destination as the headline | draft |
| v7-boarding-detail | v2 developed: tidy phone layout, timeline, full trip details (owner direction) | approved |
| v8-boarding-complete | v7 plus bags per traveller, paid extras, calendar link, switchable fare rules | approved |
