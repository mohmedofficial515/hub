---
app: web
page: email-otp
route: "e-mail: identity.otp (no web route)"
live-url:
sources:
  - backend/src/modules/notifications/infrastructure/templates/identity.otp.html.hbs
status: designing
---

# Verification code e-mail (trial)

## Purpose
Trial of the booking confirmation design on a message with no trip. The person only needs the code.

## Versions
| Version | Idea | Status |
|---|---|---|
| v1-baseline | current production template | reference |
| v2-boarding-stub | approved ticket design applied unchanged | approved |
