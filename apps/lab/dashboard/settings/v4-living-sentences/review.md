# Review — dashboard/settings/v4-living-sentences (2026-11-19)

Reviewer: ux-critic. Method: own headless Chrome (Playwright, not the shared MCP), source reading of `i18n.ts`, `parts/*.tsx`, and visual inspection.

**Evidence limits (read first).** The lab server (`127.0.0.1:7320`) became unresponsive under the parallel reviewers' load (curl timed out at 20 s, Playwright navigations timed out at 120 s). My own live captures therefore cover only three group pages at 1440 ar light (`refund_policy`, `security`, `fraud_policy`, with measured token height, overflow, font and DOM text). Everything else was judged from the author's own screenshots in `../shots/` (overview, popover, review, history, search, advanced, maintenance, gateways, prefs, 390 dark group/review/dirty) plus the source. NOT verified live by me: contrast ratios (no computed colours), keyboard focus order, reduced-motion behaviour, 768 px layouts, LTR/English output, the `flights` page, the "Details-only" fallback page, popovers for each control type, no-result / loading / error / forbidden states. Treat accessibility and responsiveness scores as provisional.

## Scores (1–5)
| Pillar | Score | One-line verdict |
|---|---|---|
| Hierarchy | 4 | Chapter, group, paragraph and token tiers are clear; the legend plus "see also" margin competes with the paragraph |
| Clarity / information architecture | 3 | Excellent for "what is the rule now"; weak for scanning and finding one field among 600+ (field names are hidden inside tokens) |
| Creativity | 5 | The policy-book idea is the most memorable of the set; review and history in prose are genuinely new |
| Visual polish | 4 | Calm, neutral cards, Cairo, no stripes; loose punctuation gaps next to chips and very airy line height |
| RTL / Arabic language quality | 3 | Plural agreement is mostly right and impressive; orthography, fragments, nameless rule lines and badge text inside sentences hurt |
| Accessibility | 3 | Good intent (labels, skip link, ring focus, status roles) but unmeasured contrast, tiny 10–11 px text, ~38 px tokens on mobile |
| Responsiveness | 3 | No horizontal overflow reported (`scrollWidth == innerWidth` at 1440); mobile wrapping strands "و", "،" and "." |
| Completeness | 4 | Nearly every must-have exists; a few are only partly demonstrated (see checklist) |

## Findings (prioritised)

### P0 — must fix before approval
1. **Sentences do not stay true when a value changes (owner-facing wording of financial rules).**
   - Refund: choose destination "المحفظة" and the same sentence still reads «يُعاد مبلغ الحجز الملغى إلى **المحفظة**، ومن يأخذه في المحفظة يحصل على مكافأة 3٪ فوق المبلغ» (`review-390`/`../shots/review-1440-ar-light.png`, reproduced in the review sheet). The second clause is now redundant and misleading, because there is no "who takes it" choice. Cause: `i18n.ts` `refund_policy.destination` has no variant keyed on `destination`; `templates.ts` VARIANTS only switch on booleans and a few enums (`refund_policy` only has `failed`/`topups`).
   - Fraud rules (`i18n.ts` `fraud_policy.rules`): a disabled rule renders «متوقفة: البطاقة نفسها على أكثر من حسابين … تضيف 60 نقطة», present tense, as if it applied. Fix: variant per rule (on: «تضيف»; off: «لو فُعّلت لأضافت» or hide the clause).
   - Fix both with enum-keyed variants plus a CI check that every variant of every toggle renders without a dangling clause.
2. **Rule lines have no subject.** In `fraud_policy` "قواعد التقييم" each line starts «مفعّلة: …» and the rule has no name; the owner cannot tell which rule to open (`g-fraud_policy-1440-ar-light.png`). Fix: lead with the rule name «قاعدة البطاقة المشتركة: مفعّلة، البطاقة نفسها على أكثر من …» or render these as a compact list with names.

### P1 — should fix
3. **Badge text is injected into sentences.** On proposed fields the «مقترح» badge sits mid-sentence and the DOM text reads «بعد 30 دقيقةمقترح من الخمول» (security, `g-security.txt`, screenshot `g-security-1440-ar-light.png` around y 620 to 670). The badge is visually dashed and tiny (`text-10`) but breaks the reading and copy/paste. Fix: make the badge `aria-hidden`/out of text flow, or move the proposed marker into the margin column.
4. **Wrapping and bidi punctuation.** The "و" conjunction, "،" and the final "." are separated from their token by a gap and can end up alone on a line: «و» stranded at the end of a line in "شحن المحفظة" (`../shots/group-390-ar-dark.png`, y≈1790–1830), a lone "." under the last token of "ترتيب صرف أموال المحفظة", a lone "،" at the line edge in "الأتمتة والمدد". README already admits the gap. Fix: bind the leading conjunction/punctuation to the neighbouring token with `white-space: nowrap`, or put it inside the same inline element, and drop `ms-0.5/me-0.5` margins around punctuation in `parts/sentence.tsx` (chip class around line 140).
5. **Inconsistent Arabic orthography.** Tanween alternates between «موظفًا ثانيًا», «يومًا», «حجزًا» (descriptions, header meta) and «موظفاً ثانياً», «يوماً» (sentences). Also «مسافرَين» carries tashkeel while other duals do not, and «many» forms mix «يوماً/دولاراً» with bare «نقطة/بطاقة/يوم عمل» (`i18n.ts` `nouns`, lines ~259–320). Pick one convention (recommended: tanween on the alif form everywhere, or none) and apply it to `nouns`, descriptions and meta.
6. **Field names are not visible; scanning 600+ fields is by reading.** In sentence mode the label exists only in the aria-label and tooltip; the "Details" list uses labels with units that duplicate the value («أقل عمر للحساب (ساعات) = 0 ساعة»; «حساب جديد: لكل 24 ساعة (دولار) = 500 دولار» where the label wording does not match the sentence's «1,000 دولار طوال الفترة», which is confusing). Search compensates well (path, value, help). Recommend a per-group "fields in this paragraph" hover/outline and a visible link from the sentence to its field label, and make "Advanced view" remembered per user.
7. **Token popover placement (1440).** The refund destination popover opens upward and covers the search bar, breadcrumb and page title, hiding the sentence it edits (`../shots/popover-1440-ar-light.png`); its single action "تم" is a small solid button at the far left with the reset/default info in 11–12 px text. Fix: prefer `side="bottom"` with collision padding, keep `avoidCollisions` but offset below the sticky header; larger "تم" and a visible "رجوع للافتراضي".
8. **History and review leak raw field labels.** «"أكبر شحن (USD)" صار 3,000 دولار بعد أن كان 5,000 دولار», «"مكافأة المحفظة للحجز الفاشل (%)" صار 5٪», «"الموافقة الثانية على الاسترداد من (USD)"» (`../shots/history-1440-ar-light.png`): unit suffixes in parentheses duplicate the value and read as schema. Also the date wording «قبل 17 يومًا» uses a different tanween than the sentences. Strip the `(unit)` suffix from sentence-form labels.
9. **Search result layout and highlight.** In result cards (`../shots/search-1440-ar-light.png`) the live value is pushed to the far left, away from its label (large dead gap), and the match highlight splits the definite article («ال|محفظة»), leaving a half-highlighted word. Fold "ال" into the highlighted range, and put the value next to the label.
10. **Mobile tap size.** Tokens measure 45 px high at 1440 (my measurement, contradicts the README's "~38 px" for desktop) but visibly ~36–38 px at 390. They pass WCAG 2.5.8 (24 px) via the inline exception, but not the 44 px target the project holds elsewhere. On a touch device two stacked tokens separated by ~12 px of leading are easy to mis-tap. Mitigation: raise vertical padding at `max-sm`, or add a tap-to-expand "edit paragraph" sheet on mobile.
11. **Sentence quality (Arabic), a representative sample.**
    - Fragment without a verb: «وتنبيه الدخول للموظفين في كل دخول.» and «وتنبيه الدخول للعملاء عند جهاز أو موقع جديد» (`security` staff/customer subsections).
    - Unnatural verb: «ويصل المالكَ بريد بكل قفل» (should be «ويُرسَل بريد إلى المالك عند كل قفل»).
    - Long nested paragraphs: the `topups` template and `cardTesting` template are ~70 words with six tokens in one sentence; on 390 they become unreadable walls. Split into 2–3 sentences, or into a short bullet list.
    - Clause-sized tokens: «يصل المالك بريد بكل قفل», «يختار العميل أين يُعاد المبلغ», «محفوظة هنا في لوحة التحكم» are whole phrases inside a chip, so the chip looks like a button label, not a value.
    - «وضع إنتاج» should be «وضع الإنتاج» (payment gateways).
    - Group description for `fraud_policy` (source text): «مراجعة المخاطر التي تحجز الحجز المدفوع المشبوه» repeats the stem.
    - The English side was not reviewed live.
12. **Contrast and tiny text (unmeasured).** I could not measure computed colours. By eye: `text-muted-foreground` at 11–12 px on `bg-card` (default-value lines such as «الافتراضي: …», legend, "see also" subtitles, `text-10` badges) is the weakest area; chip text `text-primary` on `bg-primary/10` and the dark-mode amber chip need a computed check. `text-10`/`text-11` appear in `parts/ui.tsx`, `body.tsx` and `sentence.tsx`.

### P2 — polish
13. Overview page height is ~6,700 px at 1440 (`ov-1440-ar-light` earlier capture): 8 chapters, ~30 dense sentences; a collapsed-by-chapter default or a "show 1 line per group" mode would help. The warning triangles in the TOC lack a legend on the overview (they are explained only on hover).
14. "كيف تقرأ الصفحة" legend uses the same "14" sample chip three times; use realistic sample values or one sentence legend.
15. Reset buttons read «أعِد القسم للافتراضي (1)»: the number in brackets has no noun. Use «(قيمة واحدة)» via the existing `valueNom` plural.
16. Maintenance: a long English custom message is truncated mid-word with an ellipsis inside a chip («wo…»); show full on hover or wrap.
17. Gateways secrets chips («••••7Q2x», `pk_live_51N...Hq8`) have a bullet dot (changed-from-default) that reads as part of the secret. Also `(env)` appears inside the Arabic description.
18. Review sheet at 390: the "type the group name to confirm" field sits below the fold behind the sticky footer; make the footer button show a short reason when disabled.

## Checklist against the must-have list
| Item | Status |
|---|---|
| Field-level search with path and deep link | Pass (path Chapter › Group, live value, help, filters, deep link `g=&f=`); highlight details P1-9 |
| Dirty state and sticky save | Pass (`../shots/dirty-390-ar-dark.png`: «2 تغييران بانتظار الحفظ», dirty chip tint, discard + review) |
| Readable review, no JSON | Pass, strongest part (struck old, highlighted new; wording issue P0-1) |
| Confirmations (high risk, security) | Present («تغيير حساس. اكتب «سياسة الاسترداد» للتأكيد», approval banner); not exercised for security checkbox |
| History and forward-only restore | Pass (restore stages a draft, «ستُنشئ النسخة 18») |
| Reset to default | Pass (per section and per field in popover) |
| Proposed-field marking | Pass visually (dashed violet + badge); sentence-flow issue P1-3 |
| Control per field type | Partly verified (radio list, segmented, tag list with Add, IP chips seen in advanced view); other types not checked |
| Overlaps explained without duplication | Pass ("انظر أيضاً" margin with one-line why) |
| Empty / loading / no-result / permission states | Implemented in source (`states.tsx`, `search.tsx`, owner-only banner); not captured by me |
| Owner rules | No card stripes; no physical left/right/ml/mr classes found in `parts/*.tsx`; Cairo confirmed (computed `Cairo`) |
| Reduced motion | Source: `useReducedMotion` in `page.tsx`, `motion-reduce:` on transitions, popover animation guarded; not run |

## Strengths (vs baseline)
- Review sheet and history in prose are a real step up: the baseline shows raw before/after fields; here the owner reads old and new policy side by side and can restore forward only.
- Overview in one sentence per group answers "what is configured now" at a glance; baseline needed opening each card.
- Arabic plural agreement is above average: «يومين», «3 أيام», «14 يوماً», «حسابين», «محاولات فاشلة» render correctly from `Intl.PluralRules('ar')`; durations normalise (1440 min becomes «يوم»).
- No coloured stripes; state markers are small dots, tints and dashed outline.
- Sticky save bar with count and discard is clear and well sized on mobile.
- "Advanced view" gives a classic row view with key and default for power users, so sentences do not replace precision.
- Group pages with "انظر أيضاً" margin solve the overlap problem the audit raised.

## Does the metaphor help or hurt?
It helps comprehension, trust and review (you can read the rule and sign it off), and hurts rapid scanning and precision editing: values are tokens inside prose, labels are hidden, and the page is long. It works best for the 12 hand-written groups and degrades to a "Details" list for the rest, creating two visual modes in the same page and a maintenance burden (templates must follow backend fields). Recommendation: keep v4 as the main reading and review experience, add always-visible field labels on hover/focus and a compact "list of fields in this section" toggle, and make sure variant templates are test-covered.

## Verdict
v4 is the boldest and most memorable of the redesigns and its review/history/overview story is clearly better than the baseline, but it is not ready for approval: some sentences stop being true when a switch or enum changes (financial wording in refund and fraud), rule lines lose their names, the Arabic orthography is inconsistent, and the inline-token layout wraps poorly on mobile. With variant-aware templates, a wording pass by the owner, tighter punctuation binding, and measured contrast and mobile tap targets, it could become the reading and sign-off layer of the settings area, ideally paired with a scannable field list for power use.

## Screenshots
Own captures (`review-shots/`): `g-refund_policy-1440-ar-light.png`, `g-security-1440-ar-light.png`, `g-fraud_policy-1440-ar-light.png` (+ DOM text `g-*.txt`, `_log.txt` with measurements and timeouts).
Author shots used as evidence (`../shots/`): `group-390-ar-dark.png`, `popover-1440-ar-light.png`, `review-1440-ar-light.png`, `review-390-ar-dark.png`, `history-1440-ar-light.png`, `search-1440-ar-light.png`, `advanced-1440-ar-light.png`, `prefs-1440-ar-light.png`, `maintenance-1440-ar-light.png`, `gateways-1440-ar-light.png`, `dirty-390-ar-dark.png`.
