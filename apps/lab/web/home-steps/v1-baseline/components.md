# Baseline components (home "how booking works")

| Part | File |
|---|---|
| Section | `src/features/home/features-section.tsx` (`FeaturesSection`, mounted by `src/features/home/index.tsx`) |
| Decorative planes (top and bottom corners) | `src/components/shared/decorative-plane.tsx` |
| Strings | `messages/{ar,en,tr}/domains/home.json` → `home.features` (`subtitle`, `headingLine1`, `headingLine2`, `description`, `steps.chooseDestination|makePayment|readyForTravelling`) |
| Step icons | hot-linked PNGs from `travlla.dexignzone.com` (template site) |
| Right-column photos | hot-linked Unsplash photos via `next/image` |

Behaviour: hover (desktop) or tap (phone) on a step changes the photo; phones show a compact list without the photo
column changing on hover. Screenshot: `1440-rtl-light.png` (owner, 2026-11-22, sandbox, AR, light).
