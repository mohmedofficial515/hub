---
version: v4-living-sentences
title: Living sentences
status: draft # draft | review | approved | rejected | ported
base: v1-baseline
created: 2026-11-18
tokens: inherit # inherit | override (see tokens.css)
touches-components:
  - src/features/settings/settings-overview-page.tsx (replaced by the policy book: chapters + one live summary sentence per group)
  - src/features/settings/components/cluster-layout/ (cluster-layout, cluster-header, cluster-nav, cluster-tab → one table of contents with chapters, expanding to groups)
  - src/features/settings/components/server/server-settings-group.tsx (header + margin column, history sheet as sentence timeline, review as before/after sentences)
  - src/features/settings/components/server/settings-sections.tsx (curated sub-sections from the catalog instead of one section per compound field)
  - src/features/settings/components/server/setting-row.tsx (kept as the "Advanced view" row; the default view becomes sentence tokens)
  - src/features/settings/components/server/schema-field.tsx (controls reused inside token popovers)
  - src/features/settings/components/tabs/ (appearance, tables, notifications → preference sentences, applied instantly)
  - src/features/settings/components/payment-gateways/payment-gateways-panel.tsx (sentence per gateway + masked secret details)
  - src/features/settings/components/whatsapp-provider/ (status sentence + test action)
  - src/features/settings/catalog/ (new: 8 sections, sentence templates ar/en, variants, related-group notes, maintenance entry)
  - src/features/settings/lib/field-text.tsx (new: value-in-words formatter with Arabic plural agreement, phrases per enum value)
  - src/components/shared/form/ (NumberField stepper with unit + range line, tag list with up/down, secret field with owner-only reveal)
  - src/components/ui/popover.tsx, src/components/ui/tooltip.tsx (token popover + hover card; no API change)
  - new: src/components/shared/sentence/ (Sentence parser + Token)
ported: # branch / commit once ported
---

# Living sentences (الجمل الحية / كتاب السياسات)

Open: `http://127.0.0.1:7320/lab/frame-dashboard.html#/settings/v4-living-sentences?lang=ar&theme=light`
Deep link to a field: `…?lang=ar&theme=light&g=refund_policy&f=walletIncentivePercent` (also `view=prefs`, `q=<search>`, `adv=1`,
`viewer=staff`, `state=loading|empty|error`).

## Idea
Settings are rules, and the owner thinks in rules, not schema keys. So the whole settings area reads as a **policy book**. The
overview is a table of contents of the 8 chapters (the sections); under each chapter every group is one readable sentence built
from its live values («يُعاد مبلغ الإلغاء إلى **المحفظة أو البطاقة، كما يختار العميل**، ويصل استرداد البطاقة خلال **10 أيام عمل**،
وما فوق **250 دولاراً** يحتاج موافقة ثانية»). Each value is a token: on the overview it opens the group at that field; on a group
page it opens a small editor right where it sits, and the sentence rewrites itself as you change it. What does not read as prose
(urls, secrets, long lists, structured rules, leftovers) sits in a tidy "Details" list under the paragraph, engineering fields fold
under "Advanced", and an «عرض متقدم» toggle turns every field into a classic row for power users. Review and history use the same
language: the old sentence struck, the new one highlighted; history is a sentence timeline. Preferences are written in the first
person and apply at once. Against the baseline this replaces a directory of cards with state you can read, makes every field
reachable from search, and turns the diff into prose.

## Key decisions
- **Templates in `i18n.ts`** with a tiny syntax (`{key}`, `{key:noun}`, `{key?yes|no}`, `{=computed}`, `**bold**`) and inline
  conditions `[[cond|text]]` (`key`, `!key`, `key=A,B`, `key!=A`, joined by `&`), resolved in `parts/templates.ts`. A clause that
  only holds for some values sits in a condition, so a sentence never contradicts its value (refund destination «المحفظة» no longer
  adds «ومن يختار المحفظة…»; a disabled fraud rule reads «… متوقفة، فلا تُحتسب نقاطها»). Hand-written for the 12 asked groups plus maintenance,
  payment gateways (one shared template), WhatsApp, platform region and the three preference tabs; every other group has a one-sentence
  overview summary and a Details list on its page.
- **Arabic agreement** through `Intl.PluralRules('ar')` (one / two / few / many / other): «يومين»، «3 أيام»، «14 يومًا»، «100 يوم». One orthography: tanween on the letter before alif («يومًا، موظفًا»), matching the mock texts and `Intl` dates; feminine accusatives stay bare («60 نقطة»).
  Nouns after a preposition use the genitive dual; subject counts (`changeNom`, `valueNom`) the nominative. Durations show in the
  largest exact unit (1440 min → «يوم»، 72 h → «3 أيام»، 730 days → «سنتين»), the stepper still edits the stored unit.
- **Coverage is automatic**: a field read by the current sentence variant is a token; the rest of the subsection goes to Details. When
  a switch turns a rule off, its now-silent values move to Details instead of disappearing.
- **Markers without stripes**: live value = soft primary tint; changed from default = small dot after the value; unsaved = highlighter
  tint; proposed = dashed violet frame + «مقترح» badge (tooltip: proposal id, priority, needs backend); deprecated = struck + «قديم»;
  read-only = muted with a lock. Cards keep neutral surfaces; tints only on small badges.
- **One save mode per form**: organisation groups keep a per-group draft (kept when you navigate away; TOC and overview show a draft
  dot/badge) and a sticky bar «N تغييرات بانتظار الحفظ» with Discard (undo in the toast) and Review. Preferences apply instantly.
- **Friction in proportion**: any `risk: 'high'` field in the diff asks to type the group name (ar, en or key); a `control: 'security'`
  field asks for a checkbox; `approval: 'second-approver'` groups say the change waits for a second approver and create a pending
  request banner (withdrawable) instead of a version. Reason is optional (500 chars).
- **History** from SETTINGS_HISTORY: who, when, quoted note, each change as a sentence («"أكبر شحن" صار 3,000 دولار بعد أن كان
  5,000 دولار»), request + approver when applied from a request. Restore is forward only: it stages the older values as a draft
  labelled «استعادة النسخة 15» and saves as v18.
- **Search** reaches fields (label, help, key, value; ar + en, Arabic letters folded), shows the path Chapter › Group › Subsection,
  the live value and help, with filters (differ from default, unsaved, proposed, sensitive); a result opens the group, scrolls to the
  token and pulses it; «/» focuses search. No-results suggests words.
- **Overlaps (audit §9.2)** are explained in the margin «انظر أيضاً» with one line why, so every group appears once.
- **Permissions**: lab panel switches the reader to "staff": payment gateways disappear (chapter says what is hidden and why), the
  Cartat account subsection is hidden, secret reveal is owner only. A deep link to gateways shows the owner-only state.
- **States**: boot skeleton of the book, empty, error with retry, forbidden, no results (lab panel + `state=` param).
- **Maintenance** shows with a «جديد» badge and its attention note; gateways and WhatsApp are the two special pages (masked
  secrets, owner note, status sentence, test message action that is not saved).
- Primitives on `radix-ui` directly: the dashboard's Sheet/Dialog import `next/navigation` through `CloseLabel`, which the lab cannot run.
- **Self-test** `parts/selftest.ts` (`runSelfTest()`, pure TS): renders every template in ar and en over the combinations of the
  switches and enum values it reads and fails on empty output, leftover syntax, double spaces, space before punctuation, a missing
  final stop, a known contradiction (33 rules: refund destination, failed bookings, top-ups, lockout, allow-list, alerts, OTP,
  CAPTCHA, review, every fraud rule, 3-D Secure, card testing, wallet, markup mode, tax mode, fare calendar, supplier balance, ops
  alerts, quiet hours, loyalty, maintenance, gateway mode, WhatsApp) and, for the hand-written groups, any sentence over 4 tokens or
  40 words. Result 2026-11-19: 103 templates, 7,924 renders, 0 failures (longest sentence 24 words, at most 4 tokens). With the
  old refund and fraud wording it reports 8 failures.
- **Fraud rules** lead with their name («**البطاقة المشتركة بين الحسابات** مفعّلة: إذا ظهرت…»), as do tiers and gateways.
- **Badges out of the text**: «مقترح» / «قديم» are drawn with CSS `content: attr()` on an `aria-hidden` span, so copy/paste and the
  DOM text keep the sentence intact; the state is in the token's accessible name. A one-letter prefix (و، بـ، لـ، ف) and closing
  punctuation are bound to their token with a no-break wrapper, so they never sit alone on a line.
- **Field names**: a quiet caption with the field name appears above a token on hover and keyboard focus (CSS pseudo content, not
  in the copy text); the tooltip with help and default follows after 600 ms; Details rows and history/review lines show labels
  without unit suffixes («أكبر شحن» not «أكبر شحن (USD)»).
- **Touch**: below 1024px tokens are at least 44px tall (measured 44.0px at 390) with line-height 2.75; desktop tokens 35-45px.
  Popovers open below the token (collision padding 96px under the sticky header) with a full-size «تم» and an outlined reset.
  No text under 12px (measured: 0 elements).
- **Contrast** (measured in the browser through a 1×1 canvas, composited over the real backgrounds; ratio, light / dark): value chip
  7.56 / 14.09 (light chip text is the primary mixed 25% toward black), unsaved highlighter 12.6 / 10.0, proposed badge 5.03 / 6.42,
  small badge 7.09 / 6.26, muted paragraph text 5.33 / 6.61, Details labels 5.47 / 5.99. Before the fix the light chip was 4.23.
- Search highlights the whole word around the match (no split «ال»), and the live value sits under its label.

## Verification
- `pnpm lab:check` (F:/Goteav/hub): all versions compile. `tsc --noEmit` on this folder: 0 errors.
- Screenshots in `shots/` (Playwright, own Chromium): overview at 390/768/1440 × rtl/ltr × light/dark (full page), plus
  group, token popover, dirty state, review, history, preferences at 1440-ar-light and 390-ar-dark, and maintenance, advanced view,
  search, no results, gateways, fraud rules, security (proposed fields), WhatsApp and the owner-only state for a staff reader
  (`forbidden-1440-ar-light`) at 1440-ar-light. `scrollWidth == innerWidth` in every capture. Review (`review.md`) P0 and P1
  findings addressed 2026-11-19; P2: reset count now has its noun, secrets lose the default dot, chip text truncates only after 110
  characters; overview length and legend samples unchanged.

## Open questions
- Wording review: the Arabic templates are hand-written; the owner should read them once (especially fraud rules, refund failures,
  maintenance schedule) before a port.
- Sentence templates live in the frontend catalog: who keeps them in step when a backend field is added? (Proposal: a CI check that
  every schema field is either in a template or explicitly listed as "details".)
- Second-approver groups: should the owner apply directly (as today) with the request path only for others? The lab always sends
  for approval to show the path.
- Should the overview's summary sentences be editable in place (today they open the group at the field)?
- Not verified: a real screen reader, Safari, real touch device. The shared lab server was slow and reloaded under other agents'
  writes; interactions were checked by script, not by hand.
