# References for the flight checkout (GTV-521)

No new web research was run for this page. It draws on the phase-3 research set, read on 2026-11-21:

| Source | What this page takes from it |
|---|---|
| `F:/Goteav/research/web-uplift-2026-11/design/references.md` §2, §6 B "Checkout", §8, §9 | Two columns; numbered section cards; sticky summary with a solid navy header strip and hairline price lines; stepper discs (done teal + ink check, current navy, upcoming outline); 48px inputs, 8px radius; errors as icon + sentence; the boarding-pass exactness as the creative source; no glass, orbs, stripes, teal text on white. The gold Pay button of direction B is **not** used: the owner kept the teal button with white text. |
| `F:/Goteav/research/web-uplift-2026-11/05-design-system-audit.md` B.1–B.9 | Radius roles (8 controls, 18 cards, 22 photo cards only), elevation 0 for cards, 2px border only for selection, button variants (`action` once per view, `outline` for the rest), type scale (no 13px, weights ≤ 700, tabular figures), motion 150–300ms with reduced-motion guard. |
| `F:/Goteav/research/web-uplift-2026-11/audit/03-journey-logic-audit.md` J4, L-15, L-37, L-38, L-56, L-63 | Drop the photo hero and use "أكمل حجزك"; disclose service fee, Goteav cancellation fee and FX margin before payment and in the booking currency; derive Title from gender; hide "save traveller" for guests. |
| `F:/Goteav/research/web-uplift-2026-11/01-competitors-global.md` G-16, G-19 | Total price first, extras opt-in; Latin name read from the passport is a real gain for Arabic-name customers (transliteration errors). |
| `F:/Goteav/research/web-uplift-2026-11/02-competitors-regional.md` R-06 | Order methods by the visitor's country: Apple Pay and mada first in KSA, KNET in Kuwait; one wallet tap above card. |
| `F:/Goteav/research/web-uplift-2026-11/04-assist-tools-and-profile.md` rows 2–5, 14 | Inline hints stay on the page; the name guard should say what to copy; the saved-traveller picker is a plain select and `avatarColour` is unused; the charge-currency explanation exists but is long. |

Screenshots used: `audit/shots/08-reservation-gate-top-ar-1440.png` (copied to `v1-baseline/1440-rtl-light.png`)
and `design/shots/stripe-checkout-demo-1440.jpg` (summary + method layout reference).
