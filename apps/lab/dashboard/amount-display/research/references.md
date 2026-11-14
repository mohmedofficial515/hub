# References — Dashboard / Amount display (money in dense UI + display-currency switcher)

Research date: 2026-11-10. Screenshots in this folder: `ref-<product>-<topic>-d.png` (1440) / `-m.png` (390).
Files named `ref-test-*` are my own browser tests (Chrome 157, Windows 11 build 26300), not products.
Builds on, does not repeat: `../../finance-currencies/research/references.md` (2026-10-28: Stripe currencies,
Wise, XE, TradingView EN/AR, Shopify Markets). Cited below as **[FX-research]**.

Honesty note: Stripe, Shopify admin, GA4/Amplitude, Ramp, Brex, Revolut and Wise dashboards are behind login.
For those I quote their public help/docs only and mark UI details "unverified". Mercury has a public demo
(seen live). Airwallex, Salla and Foodics UIs were seen through screenshots on their own help/changelog pages.

## Job to be done
A staff member glances at any money figure (KPI, chart, top list, table, detail, confirm, toast) and, in Arabic
or English, light or dark, reads its size, currency and basis correctly in about a second, can always reach the
exact value, and can tell whether it was converted, from what and at which rate.

---

## 0. PRIORITY 1 — Saudi riyal symbol: official facts

### 0.1 SAMA usage rules (official PDF, bilingual)
Source: Saudi Riyal Symbol Guidelines, SAMA — https://www.sama.gov.sa/ar-sa/Currency/SRS/Documents/Guidelines.pdf
(linked from https://www.sama.gov.sa/en-US/Currency/SRS/Pages/Guideline.aspx). Arabic rules on p.16, English on
p.17, each with a correct / wrong sample. Renders: `ref-sama-usage-rules-ar-d.png`, `ref-sama-usage-rules-en-d.png`.

| # | Rule (verbatim EN, p.17) | Arabic text (p.16) | Correct / wrong sample shown |
|---|---|---|---|
| 1 | Position: "The symbol should be positioned to the left of the numeral." | "يكون الرمز دائمًا يسار القيمة العددية لجميع اللغات" (always left, **for all languages**) | ✓ `⃁ 123` ✗ `123 ⃁` (same in AR) |
| 2 | Spacing: "A space is required between the symbol and the numeral." | "ترك مسافة بين الرمز والقيم العددية" | ✓ `⃁ 123` ✗ `⃁123` |
| 3 | Written Value: "The symbol should be positioned to the left of the written value." | "يكون الرمز يسار القيمة اللفظية" | EN ✓ `⃁ 123 million` ✗ `123 ⃁ million`. AR ✓: digits at the right, the word "million" (مليون) in the middle, mark at the far left. AR ✗: mark between the digits and the word |
| 4 | Negative Value: "The symbol should be positioned to the left of the minus sign and the numeral." | "يكون الرمز يسار الرقم وعلامة السالب" | EN ✓ `⃁ -123` ✗ `-⃁ 123`. AR ✓: mark at the far left, then `123`, minus sign at the right end of the digits (left→right the eye sees `⃁ 123-`). AR ✗: minus at the far left, then mark, then digits |
| 5 | Proportions: "The shape of the symbol should be maintained." | "المحافظة على تناسب شكل الرمز" | ✗ horizontally stretched |
| 6 | Geometry: "The geometric structure of the symbol should be maintained." | "المحافظة على البنية الهندسية للرمز" | ✗ altered strokes |
| 7 | Alignment: "The height of the symbol should be aligned with the height of the text." | "مطابقة ارتفاع الرمز مع ارتفاع النص" | ✗ symbol clearly smaller than the digits |
| 8 | Direction: "The direction of the symbol should match the direction of the text." | "مطابقة اتجاه الرمز مع اتجاه النص" | ✗ **mirrored** glyph |
| 9 | Negative Space: "A clear space equal to one-third of the symbol's height is required around the shapes." | "...ثلث ارتفاع الرمز داخل الأشكال" (inside shapes) | ✓ symbol inside a circle with padding, ✗ symbol filling the circle |
| 10 | Contrast: "Sufficient color contrast with the background is required." | "المحافظة على تباين الألوان مع الخلفيات" | ✗ low-contrast symbol |

Other official facts:
- Approved by King Salman on 20 Feb 2025 (21/08/1446H) — https://www.sama.gov.sa/en-US/Currency/SRS/Pages/default.aspx
- Intended fields (p.19): banking services, trading platforms, economic reports and contracts, invoices and receipts,
  applications and e-commerce stores, price tags. The p.19 app mock shows `⃁ 2,400.56` and a chart tooltip `⃁ 2600.00`
  in the text colour.
- **Colour:** no colour is prescribed anywhere in the PDF; only rule 10 (contrast). Samples use the text colour.
  Painting the mark in `currentColor` is therefore consistent (inference, not a stated rule).
- **Compact units (K/M/B):** NOT addressed. The only related rule is 3 (written value: word "million/مليون").
  By analogy the symbol stays left of the whole number+unit group (`⃁ 1.25M`). This is my inference, unverified.
- Official files: SVG `https://www.sama.gov.sa/ar-sa/Currency/Documents/Saudi_Riyal_Symbol-2.svg`
  (viewBox `0 0 1124.14 1256.39`, two paths, fill `#231f20`), PNG 3000×3353, EPS (download page above).
- FAQ page `https://www.sama.gov.sa/en-US/Currency/SRS/Pages/FAQs.aspx` returns **404** (checked 2026-11-10).
  Secondary sites quote it as "eight rules"; the current PDF shows **ten**. Treat the PDF as authoritative.

### 0.2 SAMA Font Designers' Guidelines (size relative to digits, side spacing)
Source: https://www.sama.gov.sa/ar-sa/Currency/SRS/Documents/Font_Designers_Guidelines.pdf (33 pages).
Renders: `ref-sama-font-vertical-alignment-d.png` (p.9), `ref-sama-font-spacing-d.png` (p.12).
- Vertical alignment (p.8): "The top of the Lam should align with the top of Latin numerals." "The bottom of the
  Lam sits on the baseline." If Arabic numerals sit higher, "one can align the Alef with the top of the Latin
  numerals." Construction (p.5): "The dots of the Yaa' must fall below the baseline." → the mark is figure-height,
  with a small descender.
- Spacing (p.11): "In a typically spaced font in a regular weight, the right side-bearing should be at least 1.5x
  the gap between the Alef and the Lam." Monospaced fonts follow "the logic used for the other currency symbols
  like the dollar, the pound, or the euro."
- Weight (p.14): may match the typeface weight; "The strokes must maintain their visibility and distinctness at
  small sizes." General (p.3): it "must work well with numerals in both Arabic and Latin scripts and should
  harmonise with other currency symbols that are found in the font."

### 0.3 Unicode, CLDR and font support
| Fact | Status | Source |
|---|---|---|
| Code point **U+20C1 SAUDI RIYAL SIGN**, Currency Symbols block, Unicode **17.0** (released 9 Sep 2025) | Confirmed | SAMA proposal L2/25-075 https://www.unicode.org/L2/L2025/25075-saudi-central-bank.pdf ; https://blog.unicode.org/2025/09/unicode-170-release-announcement.html |
| UCD line: `20C1;SAUDI RIYAL SIGN;Sc;0;ET;;;;;N;;;;;` → General_Category Sc, **Bidi_Class ET** (like `$`), not mirrored, no decomposition | Confirmed | https://www.unicode.org/Public/17.0.0/ucd/UnicodeData.txt |
| Not U+FDFC RIAL SIGN (Iranian; Bidi AL; decomposes to letters; "can cause unintended reorderings of numbers" in LTR) | Confirmed | SEW recommendation L2/25-076 https://www.unicode.org/L2/L2025/25076-sew-recommendations-saudi-riyal.pdf |
| CLDR 48 adds it only as an **"alternative"** symbol, "to avoid the symbol being displayed in contexts where fonts might not yet support" it; default later | Confirmed (plan) | https://blog.unicode.org/2025/03/support-for-new-saudi-riyal-currency.html ; CLDR 48 released 2025-10-29 https://cldr.unicode.org/downloads/cldr-48 |
| Chrome 157 `Intl` still prints the old forms: `ar-SA` → `‏١٬٢٥٠٬٠٠٠٫٥٠ ر.س.‏` (Arabic-Indic digits, code after); `en-*` → `SAR 1,250,000.50` even with `currencyDisplay:'narrowSymbol'` | Tested 2026-11-10 | own test (no screenshot; values in this file) |
| Windows 11 (build 26300) core fonts render U+20C1: Segoe UI, Arial, Tahoma, Times New Roman, Courier New, Segoe UI Symbol | Tested | `ref-test-windows-riyal-glyph-d.png` |
| **Cairo (the dashboard font, Google Fonts build) has no U+20C1 and no ₺ (U+20BA)** → browser falls back to another font; it does have `$ € £` (tabular, 0.56em) | Tested | own test |
| macOS / iOS / Android glyph support | **Unverified** | Unicode says vendor rollout takes "at least one year, and often longer": https://blog.unicode.org/2026/02/from-central-bank-to-code-point-roadmap.html |
| Gulf follow-ups: **U+20C3 UAE DIRHAM SIGN** and **U+20C4 OMANI RIAL SIGN** approved for Unicode 18.0, also "alternative" in CLDR first | Confirmed (approval); release Sept 2026 reported by press | Unicode blog Feb 2026 (above); https://thenationalnews.com/future/technology/2026/09/22/uae-dirham-symbol-keyboard-unicode |

### 0.4 What this means for `<Amount>` (my derivations, check visually)
- One LTR isolate holding `[mark][space][sign][number][unit]` satisfies rules 1–4 in both languages, whatever
  the surrounding text (see bidi test, §3). This confirms the plan's isolate decision.
- **Mark size (rule 7 + font guide):** in the official SVG the Lam runs from y=0 to the baseline at y≈1161.65 and the
  Yaa dots reach 1256.39. So box height = **1.0816 × figure height**, box sits **0.0816 × figure height** below the
  baseline, width ≈ 0.968 × figure height. Cairo's Latin figure height measures **0.67em** (cap 0.69em, CSS `1cap` = 0.70em)
  → box ≈ **0.725em**, `vertical-align ≈ -0.055em`, width ≈ 0.65em. The plan's 0.8em box makes the mark ~10%
  taller than the digits. See `ref-test-riyal-svg-sizing-cairo-d.png` (rows A–E).
- **Gap (rule 2):** SAMA's samples show a gap of roughly 0.3 × figure height (my measurement) → `margin-inline-start: .25em`
  on the number or a real space inside the isolate.
- **Never mirror (rule 8):** no `rtl:-scale-x-100`, no icon auto-flip on the mark.
- **Shapes (rule 9):** a currency avatar (e.g. in the switcher menu) needs padding ≥ 1/3 of the mark height.
- **Contrast (rule 10):** the muted converted line must still meet 4.5:1; never dim the mark more than the digits.
- Prefer the font glyph where Cairo has it (`$ € £`) and SVG only where it does not (⃁, ₺, and the new AED/OMR signs),
  so weights harmonise as the font guide asks. The SVG has one fixed weight; check it next to weight-700 KPI digits.

---

## 1. Reference table
| # | Product (evidence) | Pattern | Why it works | Fit for Goteav |
|---|---|---|---|---|
| 1 | **Mercury** live demo https://demo.mercury.com/dashboard (`ref-mercury-demo-dashboard-d/m.png`, `ref-mercury-balance-chart-hover-d.png`, `ref-mercury-transactions-d.png`) | Primary figures exact with **superscript cents**; secondary flows compact (`$1.8M`, `−$477K`); hovering the chart swaps the **headline** for the exact value + date; true minus `−` before `$` | Big number stays exact and calm; compact only where it is context; no tooltip covers the chart | High: KPI scrub idea, minus style, end-aligned tabular table. Superscript cents = visual change (owner approval) |
| 2 | **Airwallex** web app, help-centre screenshots https://help.airwallex.com/hc/en-gb/articles/4402493305881 (`ref-airwallex-*`) | Page-level **"View in: HKD"** picker beside the total; each balance shows native `642.50 EUR` + smaller converted `5,709.56 HKD` under it; ISO code after amount; chart axis `1M/750K/500K` | Native truth first, equivalent second; picker sits where the converted total is | Very high: exactly D1a. Copy the two-line cell; keep the "View in" wording for the switcher label |
| 3 | **Stripe** (docs only) https://support.stripe.com/questions/dashboard-home-page-charts-for-business-insights ; https://docs.stripe.com/reports/options | Home charts in the account's main currency "will include estimates of foreign exchange rates"; Reports keep one view **per settlement currency** with a currency selector | Says plainly that converted charts are estimates; never mixes currencies in a finance report | High for wording and for "reports per native currency". UI itself unverified |
| 4 | **Shopify** https://help.shopify.com/en/manual/markets/pricing/exchange-rates ; https://help.shopify.com/en/manual/markets/pricing/limitations ; https://shopify.dev/docs/apps/design/content/grammar-and-mechanics | Reports only in store currency; FX "always the rate at the time of the transaction"; converted values are "estimates" until charged; style guide: `$10,000 USD`, avoid `12 k` | Same model as Goteav's D1b; clear rule for code placement in prose | High for the conversion model; their "never shorten" rule is the opposite of KPI compaction (they target prose, not tiles) |
| 5 | **Google Analytics / Amplitude** (docs) https://support.google.com/analytics/answer/9796179?hl=en ; https://amplitude.com/docs/data/currency-conversion | Reporting currency is a **property/org setting**; conversion per event at the **prior day's** rate; GA prints a disclaimer; Amplitude names the metric "Currency Converted Revenue" | Basis is stated in words and in the metric name | Medium-high: copy the disclaimer sentence and the "converted" naming. Card UI unverified |
| 6 | **Ramp / Brex** (help) https://support.ramp.com/multi-currency-funds-cards-and-spend-programs ; https://www.brex.com/support/using-brex-internationally | Ramp: globe icon when original ≠ statement currency, hover shows the original amount; Brex: both USD and original shown | Cheap per-row cue that a conversion happened | Medium: a small "converted" cue on rows; hover-only reveal must become focus/tap |
| 7 | **Revolut Business** (help) https://help.revolut.com/en-AU/business/help/managing-my-business/profile-and-settings/what-is-my-total-balance/ | Total across currencies shown "in your base currency, which is determined by your business country of registration"; "Hide balances" toggle | Simple, but the user cannot choose | Low-medium: contrast case; Goteav lets each staff choose (D1c). Hide toggle matches `SensitiveAmount` |
| 8 | **Salla** merchant dashboard (Arabic), help screenshots https://help.salla.sa/article/%D8%A7%D9%84%D8%B5%D9%81%D8%AD%D8%A9-%D8%A7%D9%84%D8%B1%D8%A6%D9%8A%D8%B3%D9%8A%D8%A9-%D9%84%D8%A7%D8%AA%D8%AE%D8%A7%D8%B0-%D9%82%D8%B1%D8%A7%D8%B1%D8%A7%D8%AA%D9%83-%D8%A8%D8%B0%D9%83%D8%A7%D8%A1/pl43zdtyvxnp4j544lvqdtik (`ref-salla-ar-*`) | RTL dashboard: `⃁ 203.90` with mark **left + space**, Latin digits, two decimals same weight; list amounts at row end; the mark also appears inside Arabic prose ("store balance" + `(⃁ 0.80)`); an early-2025 build showed `SAR 1,781.40` | Saudi-first proof that SAMA placement works in an RTL admin | High as RTL evidence. Avoid its mixed digits (Arabic-Indic year in the card title, Latin amounts) |
| 9 | **Foodics Console** changelog https://changelog.foodics.com/new-currency-symbols-on-console-for-uae-and-ksa-businesses-4CCsZq (`ref-foodics-*`) | KPI tiles `Net Sales ⃁ 0`; UAE accounts see the new dirham sign; rollout "as mandated by the local authorities" (KSA mid-Feb 2025, UAE mid-Aug 2025) | Gulf B2B dashboards already switched symbols per country | High: catalog must carry SAR and AED (and OMR) marks |
| 10 | **noon** Arabic storefront https://www.noon.com/saudi-ar/ (`ref-noon-ar-prices-d.png`) | `⃁2899` left of digits but **no space**; glyph is private-use **U+E000** drawn by web font "NoontreeCurrency" | Shows the common shortcut and its cost | Anti-pattern: PUA is invisible to screen readers and copy-paste; breaks rule 2 |
| 11 | **Almosafer** Arabic travel https://www.almosafer.com/ar → global.almosafer.com/ar (`ref-almosafer-ar-topbar-d.png`) | Topbar picker `SAR ⌄` (code only) next to the language switch; on the global site a dialog says booking prices are calculated in US dollars ("يتم احتساب أسعار الحجوزات بالدولار الأمريكي") with two buttons: Saudi Arabia (flag + riyal mark) or stay on the global site (dollar) | Basis explained in one sentence before the user reads any price | Medium-high: topbar placement precedent in a Saudi travel product; copy the one-sentence basis |
| 12 | **[FX-research]** TradingView AR, Wise, XE | Sign after number in RTL (`0.12%-`); Wise names the rate "Mid-market exchange rate (?)"; XE shows base + date | Naming the rate type and date removes doubt | Reuse: name the rate ("rate of each booking day") |

Also noted: **Qoyod** (Saudi accounting SaaS) switched invoices to the new symbol; its knowledge base (in Arabic) says the
old "SAR" code cannot be restored and only the new symbol is available —
https://www.qoyod.com/knowledge-base/%d8%a7%d8%aa%d8%a7%d8%ad%d8%a9-%d8%b1%d9%85%d8%b2-%d8%a7%d9%84%d8%b9%d9%85%d9%84%d8%a9-%d8%a7%d9%84%d8%ac%d8%af%d9%8a%d8%af/ (text only, my translation).

---

## 2. Per-reference capture (the 8 questions)
Legend: (1) compaction (2) exact reveal (3) mark position/style (4) decimals (5) negative/zero (6) table alignment and
per-row currency (7) converted secondary amount (8) display-currency picker and how conversion is explained.

**Mercury** (live, 2026-11-10)
1. Exact for primary balances (`$5,216,471.18`, accounts list, top sources `GenPro $415,133.44`); compact for context
   figures: `$1.8M`, `−$477K`, `3 items · $10K`, `12 items · $12.3K`, `Paid 12 · $6K`, `Last 3 months average $433K`.
   1–3 significant digits, no `.0`.
2. Chart hover replaces the headline: `$4,202,660.51 · October 26, 2026 · ↗ $110,979.37` (delta becomes exact too).
   "Balance graph / Balance table" toggle. The compact deltas have no exact text for screen readers (accessibility tree
   reads `$1.8M`).
3. `$` prefix, no space, single currency, same colour.
4. Cents always shown on exact values as superscript: 10.95px on 15px (0.73×), raised 2.9px, same colour and weight,
   decimal point inside the superscript; `font-variant-numeric: tabular-nums`. Compact values drop cents.
5. Negative = U+2212 before the symbol `−$750.00`, neutral colour; inflows green with no `+`; zero `$0.00`;
   failed payment struck through.
6. Amount column `text-align: end`, header end-aligned; one currency, so no per-row code.
7. n/a (USD only). 8. No picker; topbar "Toggle Private Mode" eye icon hides balances.

**Airwallex** (help screenshots dated 2026)
1. Totals exact `8,910,661.08 HKD`; chart y-axis compact `1M, 750K, 500K, 250K, 0` with no currency on ticks.
2. `(i)` icon next to "Available balance" (tooltip text not seen).
3. ISO code **after** the number, same size and colour; currency cell = flag + bold code + muted English name.
4. Always 2 decimals, same weight. 5. `-10.00 HKD` (hyphen-minus), neutral colour; zero rows keep both lines `0.00 CNY / 0.00 HKD`.
6. Amounts right-aligned, code on every row; muted "0 transactions" line under scheduled amounts.
7. Native amount line 1, converted amount (in the "View in" currency) line 2, smaller and lighter, **no "≈", no label**;
   rows already in that currency have no line 2.
8. "View in: HKD ⌄" dropdown at page level, top-right of the balance block, code only.

**Stripe** (docs; UI login-gated)
1–6 unverified. 7. Home charts convert to the main currency: "the charts will include estimates of foreign exchange
rates. Exchange rates can change, so the rates provided may not exactly match the amounts you receive."
8. Reports: "If your account has multiple settlement currencies, you can view reports for each currency separately
using the currency selector" (no cross-currency total). Presentment vs settlement model: [FX-research] row 5.

**Shopify** (help + content guidelines; admin UI unverified)
3. Prose rule: "When you include a currency with a price, the currency comes after the amount. Correct: $10,000 USD.
Incorrect: USD$10,000." 1. "avoid shortening numbers. Correct: 12,000. Incorrect: 12 k." 7. Orders in other
currencies "are converted to your store currency"; "Until you charge the customer for their order, the converted values
are estimates"; "The foreign exchange rate used is always the rate at the time of the transaction."
8. "You can view your reports only in your store currency."

**Google Analytics / Amplitude** (docs; card UI unverified)
8. GA: the property's global currency "determines the currency in which all of these values are displayed in reports";
default USD; conversion "using the prior day's exchange rate"; disclaimer "Data is based on the exchange rate one day
before the transaction, and is provided by financial exchanges." (page not labelled [GA4]). Amplitude: set in
"Organization Setting > Projects > General" → "Which currency should your values be converted to?"; "exchange rates
from the preceding day"; charts use derived properties "Currency Converted Revenue" / "Currency Converted Price".

**Ramp / Brex** (help)
7. Ramp: "The globe icon appears when the original transaction amount or currency differs from the statement amount or
currency." "Hovering over the icon shows the original transaction amount and currency." Brex: managers "will see
transactions in both USD and the original currency"; non-USD limits "show both the Euro amount and the USD amount".

**Revolut Business** (help) — 8. Total in base currency fixed by country of registration (not selectable per the
article); "Hide balances" blurs amounts on mobile.

**Salla** (Arabic, help screenshots; article updated 14 Mar 2026)
1. No compaction seen (small values); y-axis `100/200/300`. 3. Mark left of the number with a space, same colour and
weight, also inside Arabic prose `(⃁ 0.80)`. Early-2025 build: `SAR 1,781.40`, `SAR 10,000.00` (code on the left of the
number in the Arabic UI).
4. Two decimals, same weight. 6. Amounts sit at the row end (left in RTL), Latin digits. 8. No picker.
Chart time axis: newer chart runs days `2 → 30` left-to-right inside the RTL page; the older chart ran newest-left.

**Foodics Console** — 3. `⃁ 0` / dirham sign `0`: mark left, space, same colour, mark about digit height.
5. Zero printed as `0` without decimals.

**noon** — 3. Mark left, **no space**, bold; private-use U+E000 + web font. Original price struck through beside it.

**Almosafer** — 8. Topbar `SAR ⌄` beside the language switch; basis explained in a dialog sentence.

---

## 3. RTL pitfalls — bidi test (own test, `ref-test-bidi-rtl-amount-d.png`)
RTL paragraph (`dir=rtl`), Segoe UI; screen position of every character measured, read left → right.
`AR-LABEL` = an Arabic label such as "الرصيد:" (it always lands at the right end); `AR-WORD` = an Arabic word after the amount.

| Case | Typed (logical) order | What the eye sees, left → right | SAMA |
|---|---|---|---|
| A | AR-LABEL, `⃁ -123` | `123-` · `⃁` · AR-LABEL — mark jumps to the **right** of the number, minus to the right end | ✗ rule 1 |
| B | AR-LABEL, `-123 ⃁` | `⃁` · `123-` · AR-LABEL | ✓ (matches SAMA's Arabic negative sample) |
| C | AR-LABEL, `⃁ 1.25M` | `1.25M` · `⃁` · AR-LABEL | ✗ rule 1 |
| D | AR-LABEL, `1.25M ⃁` | `⃁` · `1.25M` · AR-LABEL | ✓ |
| E | AR-LABEL, isolate `dir=ltr` `⃁ −1.25M` | `⃁ −1.25M` · AR-LABEL | ✓ |
| F | AR-LABEL, isolate `⃁ 1,250,000.50`, AR-WORD | AR-WORD · `⃁ 1,250,000.50` · AR-LABEL | ✓ |
| G | AR-LABEL, `$1.25M`, AR-WORD | AR-WORD · `1.25M$` · AR-LABEL | `$` lands on the wrong side |
| I | `123`, the word "million" (Arabic), `⃁` | `⃁` · word · `123` | ✓ (matches SAMA rule 3 Arabic sample) |
| J | AR-LABEL, `-1,234.50 USD` | `USD` · `1,234.50-` · AR-LABEL | minus moves to the end |
| L | AR-LABEL, `+12.5%` | `%12.5+` · AR-LABEL | sign and % flip (same as TradingView AR in [FX-research]) |

Why: U+20C1 is Bidi ET like `$`, so in Arabic text it is resolved by its neighbours. Takeaways:
- Plain text only works if the logical order is reversed (B, D, I) — fragile. The **LTR isolate** (E, F) is stable in
  every context and gives the same picture in AR and EN.
- `1.25M`: `M` is a strong Latin letter; next to Arabic labels and other neutrals it reorders unpredictably → keep the unit
  inside the isolate.
- Minus: the isolate yields `⃁ −123` in Arabic; SAMA's own Arabic sample shows `⃁ 123-`. Both keep the mark left of the
  minus and number (rule 4). Owner decision needed (§8 Q1).
- Charts, `aria-label`, CSV and toasts are plain text: build them with the same order and wrap with LRI/PDI
  (U+2066/U+2069) or keep them LTR, never `-123 SAR` concatenations.

---

## 4. Recurring patterns (ranked by evidence)
1. **Native currency is the truth; the equivalent is secondary** — Airwallex two-line cell, Brex both amounts, Ramp
   globe cue, Shopify "converted values are estimates". (4 products + Goteav D1a)
2. **Conversion basis is stated in words** — Stripe "estimates of foreign exchange rates", GA disclaimer, Amplitude
   "Currency Converted Revenue", Almosafer dialog, Wise "Mid-market exchange rate (?)" [FX-research]. (5)
3. **Exact for the headline, compact for context and axes** — Mercury headline exact + compact deltas, Airwallex totals
   exact + axis compact, Salla/Foodics exact small values. (3)
4. **Reporting currency is chosen at account/property level; pages may add a local "View in"** — GA, Amplitude,
   Shopify, Revolut (fixed), Stripe (per settlement currency), Airwallex "View in". In this sample a global topbar
   switcher appears only in consumer travel (Almosafer); the B2B tools set it per account or per page. (6)
5. **Numbers end-aligned with tabular figures; currency per row only when the column mixes currencies** — Mercury,
   Airwallex, Salla, TradingView [FX-research]. (4)
6. **Saudi products put the new mark left of the number** (Salla, Foodics, noon, SAMA samples); spacing is often
   skipped (noon). (4)
7. **Negative = sign + neutral colour; inflow colour optional** — Mercury `−$750.00`, Airwallex `-10.00 HKD`. (2)
8. **Hide-balances toggle** — Mercury Private Mode, Revolut Hide balances. (2)

---

## 5. Patterns to adopt / avoid for Goteav, by context
(Visual changes beyond the plan need owner approval under the preserve-design rule.)

**KPI tile** — Adopt: compact from 10K with 3 significant digits (`Intl` default gives `$1.3M`; needs
`maximumSignificantDigits: 3`, gives `$1.25M`; 999,950 → `1M`, 1,500 → `1.5K`, all tested); mark left + gap; exact value on
hover **and** focus **and** tap (Mercury headline swap, or a focusable popover), plus an accessible name with the exact
value and currency words; a basis cue when display currency ≠ source (USD): `in SAR · converted` via `(i)` or caption.
Avoid: 4xl 15-digit figures; `title`-only reveal; colour-only deltas.

**Chart axis and tooltip** — Adopt: ticks as compact numbers **without** the mark (Airwallex, Salla), currency once in
the axis title/legend; tooltip exact with mark and date; converted series say so in the tooltip footer. Keep time
running left→right in RTL (Salla's newer chart; earlier research flagged it as convention) — confirm with owner.
Avoid: compact tooltips (inventory bug 13); mark on every tick.

**Top-N list** — Adopt: compact from 1K (owner rule) with exact on focus/hover; end-aligned, tabular. Mercury keeps top
sources exact — use exact when the row has room. Avoid: Arabic unit words/letters on English pages (`15 ألف` is what
`Intl` `ar` compact returns; Latin `K/M/B` must be custom).

**Table cell** — Adopt: exact below 1M; `text-align: end` + `tabular-nums` (Cairo figures are already equal width,
0.56em); currency mark/code per row only when the column mixes currencies; muted line 2 for the converted equivalent
only when currency ≠ display currency (Airwallex); unit in the header when the column is single-currency.
Avoid: "USD" in both header and cell (inventory bug 9); mixing mark and code inside one column.

**Detail field** — Adopt: exact native amount; line 2 `≈ ⃁ 46,687.50` muted; a disclosure "USD 12,450.00 at 3.7500 on
2026-10-03 (rate of the booking day)". Avoid: rounding or compaction; converted value shown as the main figure.

**Confirm dialog / toast** — Adopt: always exact and native (the money that moves); in text-only surfaces include the
code for clarity (`⃁ 1,250.00 (SAR)` or `SAR 1,250.00` in toasts/CSV — CSV should carry a currency column, plan P5).
Avoid: compact or converted amounts as the primary figure; `rs.jpg`-style images that ignore colour and dark mode.

**Topbar switcher** — Adopt: button shows mark + code (`⃁ SAR`), Almosafer-style placement next to language; menu rows:
mark in a circle with ≥ 1/3 padding (SAMA rule 9), code, localized name, search; a footer sentence explaining the rules:
"Totals convert at each transaction day's rate. Transactions keep their own currency." (GA/Stripe-style disclosure);
selection saved to profile (D1c), owner default (D1d). Avoid: the switcher as the only place that tells the basis;
flags as currency identity (one currency, many countries).

---

## 6. Bold ideas worth testing
1. **Scrub-to-headline KPI.** Mercury does not use a floating tooltip: moving along the chart rewrites the tile headline
   with the exact value and date. For Goteav: hovering, tapping or arrow-keying a sparkline point swaps the compact
   `⃁ 1.25M` for `⃁ 1,250,000.50 · 3 Oct`, Esc restores. It fixes "exact only in `title`", works on touch and keyboard,
   and changes no layout (same text slot) — fits the preserve-design rule.
2. **"How this number was made" popover.** A dotted underline on converted figures opens a receipt: source currency
   total, rate basis (each day's rate), date range, record count, and "not converted" when display = source. Treats the
   conversion like a footnote in a finance report; answers the "which basis is this KPI in?" problem at the point of use
   rather than in the topbar.
3. **Amount in words on irreversible confirms.** SAMA treats the written value as first class (rule 3). Under the exact
   figure in refund / wallet / payout confirms, print the amount in words in the UI language
   ("ألف ومئتان وخمسون ريالاً سعودياً"). A misplaced comma or digit becomes obvious before staff press Confirm; matches
   Goteav's confirmation-safety stance. (That Saudi invoices and cheques often carry amounts in words is general
   knowledge, unverified here.)
4. **Switcher with live preview.** Each currency row in the menu shows one anchor KPI (e.g. today's gross) already
   converted (`⃁ 4.68M · $1.25M · ₺53.6M`), so staff see magnitude before switching and spot a wrong default at once.

---

## 7. Anti-patterns to avoid
- Private-use glyphs for the mark (noon U+E000 + custom font): unreadable to screen readers, garbage on copy.
- Relying on `Intl` / CLDR for SAR (prints `SAR` / `ر.س.‏` and Arabic-Indic digits in `ar-SA`), or on U+20C1 text in
  Cairo (no glyph → mismatched fallback font).
- Raw `-123`, `+12.5%`, `$1.25M`, `⃁ 1.25M` in RTL text without an isolate (§3).
- Mark smaller than digits (rule 7), touching digits (rule 2, noon), mirrored in RTL (rule 8), stretched (rules 5–6).
- Compact values with no exact reveal for keyboard, touch and screen readers (Mercury deltas; Goteav `title` today).
- Two digit systems on one card (Salla `٢٠٢٥` heading with Latin amounts).
- Converted totals with no stated basis; converting real transactions (keep native, D1a).
- Using the mark on every chart tick; repeating the currency in header and cells.

---

## 8. Open questions for the owner
1. Arabic negative: `⃁ −1,250.00` (LTR isolate, same as English; recommended) or SAMA's Arabic sample form `⃁ 1,250.00-`?
2. RTL chart time axis: left→right (recommended, Salla's current chart) or mirrored?
3. USD in mixed-currency views: `$` or `USD`? (Recommended: mark in single-currency contexts, code where currencies mix.)
4. `≈` before converted equivalents (Airwallex uses none; plan uses `≈`)? Recommended: keep `≈` on transaction
   equivalents, use a basis caption (not `≈`) on aggregated KPIs.
5. Approve mark metrics for Cairo: box 0.725em, offset −0.055em, gap 0.25em (vs 0.8em in the plan).

---

## 9. ui-ux-pro-max output (searched 2026-11-10)
- Design-system query "fintech finance operations dashboard data-dense multi-currency": suggested "Dark Mode (OLED)" +
  Fira Code/Fira Sans; typography search also offered IBM Plex Sans "Financial Trust". Not applicable: Goteav keeps its
  own tokens and Cairo, light + dark (preserve-design rule).
- UX "Number Formatting" (Low): "Use thousand separators or abbreviations", good `1.2K or 1,234`, bad `1234567`.
- UX "Compact Label Overflow" (High): "expose full text to keyboard pointer and touch users"; don't use "a hover-only
  tooltip". UX "Essential Text Truncation" (Critical): "provide a visible full-detail path". → exact value reveal rule.
- Chart guidance: "Keyboard: focus reveals the same detail as hover"; visible data-table fallback (Mercury's
  graph/table toggle is a live example); never rely on hue alone.

---

## Sources
SAMA and standards
- https://www.sama.gov.sa/en-US/Currency/SRS/Pages/default.aspx — approval 20/02/2025
- https://www.sama.gov.sa/en-US/Currency/SRS/Pages/Guideline.aspx — download page (Guidelines, Font Designers' Guidelines, SVG/PNG/EPS)
- https://www.sama.gov.sa/ar-sa/Currency/SRS/Documents/Guidelines.pdf — usage rules p.16–17, examples p.19
- https://www.sama.gov.sa/ar-sa/Currency/SRS/Documents/Font_Designers_Guidelines.pdf — alignment p.8–9, spacing p.11–12, weight p.14
- https://www.sama.gov.sa/ar-sa/Currency/Documents/Saudi_Riyal_Symbol-2.svg — official SVG geometry
- https://www.sama.gov.sa/en-US/Currency/SRS/Pages/FAQs.aspx — 404 on 2026-11-10
- https://www.unicode.org/L2/L2025/25075-saudi-central-bank.pdf ; https://www.unicode.org/L2/L2025/25076-sew-recommendations-saudi-riyal.pdf
- https://www.unicode.org/Public/17.0.0/ucd/UnicodeData.txt
- https://blog.unicode.org/2025/09/unicode-170-release-announcement.html ; https://blog.unicode.org/2025/03/support-for-new-saudi-riyal-currency.html
- https://blog.unicode.org/2026/02/from-central-bank-to-code-point-roadmap.html ; https://cldr.unicode.org/downloads/cldr-48
- https://thenationalnews.com/future/technology/2026/09/22/uae-dirham-symbol-keyboard-unicode (press, Unicode 18 release)

Products
- Mercury demo: https://demo.mercury.com/dashboard ; https://demo.mercury.com/transactions
- Airwallex: https://help.airwallex.com/hc/en-gb/articles/4402493305881-Understanding-your-Borderless-cash-account-balances
- Stripe: https://support.stripe.com/questions/dashboard-home-page-charts-for-business-insights ; https://docs.stripe.com/reports/options
- Shopify: https://help.shopify.com/en/manual/markets/pricing/exchange-rates ; https://help.shopify.com/en/manual/markets/pricing/limitations ; https://shopify.dev/docs/apps/design/content/grammar-and-mechanics
- Google Analytics: https://support.google.com/analytics/answer/9796179?hl=en ; Amplitude: https://amplitude.com/docs/data/currency-conversion
- Ramp: https://support.ramp.com/multi-currency-funds-cards-and-spend-programs ; Brex: https://www.brex.com/support/using-brex-internationally
- Revolut Business: https://help.revolut.com/en-AU/business/help/managing-my-business/profile-and-settings/what-is-my-total-balance/
- Salla: https://help.salla.sa/article/%D8%A7%D9%84%D8%B5%D9%81%D8%AD%D8%A9-%D8%A7%D9%84%D8%B1%D8%A6%D9%8A%D8%B3%D9%8A%D8%A9-%D9%84%D8%A7%D8%AA%D8%AE%D8%A7%D8%B0-%D9%82%D8%B1%D8%A7%D8%B1%D8%A7%D8%AA%D9%83-%D8%A8%D8%B0%D9%83%D8%A7%D8%A1/pl43zdtyvxnp4j544lvqdtik (images https://cdn.salla.sa/GoTthL8cOffyfxPXOs9tu16SJBx69qVKlzCMuJwV.png , https://cdn.salla.sa/KFzurlZv0gmsVQQRSrd5nLv3bduV51rCo4CJ7RT9.png)
- Foodics: https://changelog.foodics.com/new-currency-symbols-on-console-for-uae-and-ksa-businesses-4CCsZq
- noon: https://www.noon.com/saudi-ar/ ; Almosafer: https://www.almosafer.com/ar
- Qoyod: https://www.qoyod.com/knowledge-base/%d8%a7%d8%aa%d8%a7%d8%ad%d8%a9-%d8%b1%d9%85%d8%b2-%d8%a7%d9%84%d8%b9%d9%85%d9%84%d8%a9-%d8%a7%d9%84%d8%ac%d8%af%d9%8a%d8%af/
- Earlier research: `F:/Goteav/hub/apps/lab/dashboard/finance-currencies/research/references.md`

Not captured / unverified: Stripe, Shopify admin, GA4, Amplitude, Ramp, Brex, Revolut and Wise Business UIs (login);
Tabby/Tamara/Zid/Al Rajhi/STC Bank dashboards (login; no public screenshots found in time); mobile captures exist only
for Mercury (`ref-mercury-demo-dashboard-m.png`).
