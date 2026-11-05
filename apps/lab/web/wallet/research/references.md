# References — Wallet (customer site, /account/wallet)

Researched 2026-10-27. No logins; all evidence is from public help pages, terms, marketing pages and
third-party reviews. Signed-in wallet screens of competitors could not be viewed — every in-app detail below
is taken from the cited help/terms text, not observed. Items marked **(unverified)** come from third-party
or affiliate sources only.

## Job to be done
A Goteav traveller opens the wallet to know, at a glance, how much they can spend on their next trip right now,
why any money is held or moved (and which booking caused it), and to turn that balance — topped up or
earned from points — into a booking.

## Reference table

| Product | Pattern | Why it works | Fit for Goteav |
|---|---|---|---|
| **Booking.com Rewards & Wallet** ([AwardWallet](https://awardwallet.com/travel/bookingcom-rewards/), [HotelDig guide](https://www.hoteldig.com/en/booking-com-rewards-wallet/), [expiry](https://awardwallet.com/blog/how-do-bookingcom-rewards-expire/)) | Rewards and wallet live on one page; each credit carries its own source and expiry; credits **apply automatically at checkout**; credits from a stay arrive only after the stay (some promos 64+ days after checkout). | Merging "rewards" and "money" into one place removes the "where is my credit?" question; per-credit expiry builds trust. | High: Goteav should show points and wallet side by side. Low: Goteav wallet cash does not expire, so do not borrow expiry anxiety. |
| **Airbnb gift credit** ([Airbnb help 3446](https://www.airbnb.com/help/article/3446)) | Balance sits under Account → Payments; balance is **applied automatically** when booking; no code at checkout. | Zero-effort spending of credit — the wallet's job ends at "you have X, it will be used". | High: copy the promise ("your balance is used automatically at checkout") as a visible line on the wallet. |
| **Hopper Carrot Cash** ([Hopper help](https://help.hopper.com/en_us/what-is-carrot-cash-HJemBY5gK.md), [How to use](https://help.hopper.com/en_us/how-can-i-use-carrot-cash-ByevPFqgF), [Going guide](https://going.com/guides/how-to-use-hopper)) | Branded credit (1 unit = 1 USD) earned as % back per product type (1% flights / 3% hotels / 2% cars — **unverified**); applies only to base fare; 6-month inactivity expiry. | A named, playful currency makes earning feel like a game and ties it to future bookings. | Medium: Goteav points already exist — give them a clear "= $X" equivalence. Avoid: reviews criticise refunds paid as app-only credit ([Atlas Heart](https://theatlasheart.com/hopper-review/)) — Goteav must label refunds clearly. |
| **Expedia One Key** ([terms](https://www.expedia.co.nz/one-key-terms), [CNBC](https://www.cnbc.com/select/expedia-one-key-rewards/)) | Two counters: **OneKeyCash** (spendable) and **Trip Elements** (progress to tier; Silver 5, Gold 15 per year — third-party figures). | Separating "what I can spend" from "how far I am to the next level" gives two motivations without mixing units. | High for the rewards link: spendable USD vs points progress should be two different visual objects. |
| **Trip.com Trip Coins / Agoda Cash** ([HotelDig Trip Coins](https://www.hoteldig.com/zh-hk/trip-coins-guide/), [AgodaCash](https://www.hoteldig.com/en/agodacash/)) | Coins visible in the app's wallet section; conversion ~100 coins ≈ $1 (**unverified**, varies by market); AgodaCash usable only on stays. | Conversion rate shown next to the coin count makes points feel like money. | Medium: show "1,200 pts = $12" live in the redeem control. |
| **Almosafer** (Arabic-first, KSA) — [almosafer.com/ar](https://www.almosafer.com/ar), screenshot `ref-almosafer-home-1440.png`, `ref-almosafer-home-390.png`; wallet evidence via bank offers: [BSF Almosafer Signature](https://bsf.sa/english/personal/cards/credit/almosafer-visa-signature), [Riyad Bank](https://www.riyadbank.com/almosafer-your-trip-on-us), [SAB](https://www.sab.com/en/personal/c/Almosafer-9june24) | Wallet is the landing place for cashback and partner points (bank card points "credited in the customer's Almosafer wallet"; SAB gave **+20% extra when redeemed into the wallet**). Site is full RTL, Arabic numerals in Latin digits, red primary CTA, icon row of services. | Shows the Gulf market already understands "wallet = travel credit that grows from partners". The +20% redeem-to-wallet bonus is a strong precedent for a top-up/redeem bonus. | High for RTL patterns and for the "bonus when you move value into the wallet" idea. The wallet screen itself is behind login (**not viewed**). `/ar/rewards` returned 404. |
| **Wego ShopCash** ([PR Newswire](https://www.prnewswire.co.uk/news-releases/wego-launches-shopcash-an-online-shopping-cashback-rewards-and-deal-discovery-app-for-the-mena-market-896292379), [Wikipedia](https://en.wikipedia.org/wiki/Wego.com)) | MENA cashback wallet that accumulates per purchase and can be spent on Wego flights/hotels. | Regional proof that a growing balance is a booking motivator. | Medium: background evidence only; current product status unverified. |
| **Revolut** ([pending explainer](https://Revolut.com/blog/post/what-does-a-pending-transaction-mean/), [help: why pending](https://help.revolut.com/help/card-payments-withdrawals/paying-by-card-issues/why-is-my-card-payment-pending) — 403 to fetch, quoted from search snippet) | Held funds are excluded from available balance; tapping a pending item shows **the latest date it will resolve**. | A hold with a deadline is trustworthy; a hold without one feels like lost money. | Very high: Goteav's RESERVE rows need "held for booking #X, released or captured by …". (Release date is not in the API — see needs-backend.) |
| **Wise transfer tracker** ([Wise help](https://wise.com/help/articles/2452305/how-do-i-check-my-transfers-status), [statuses](https://docs.wise.com/guides/product/send-money/tracking/transfer-statuses)), screenshots `ref-wise-home-1440.png`, `ref-wise-home-390.png` | Each transfer opens a step-by-step tracker (processing → received → sent). Marketing shows huge tabular amount entry ("1,000.00") with a lock-rate pill. | Turning a money movement into a story of steps removes "is it a double charge?" anxiety. Huge amount entry makes the number the hero. | Very high: RESERVE → CAPTURE/PAYMENT → (RELEASE/REFUND) is exactly a tracker. |
| **Monzo Savings Pots** ([monzo.com/savings](https://monzo.com/savings), [Pots blog](https://monzo.com/blog/2017/11/20/pots)), screenshots `ref-monzo-pots-1440.png`, `ref-monzo-pots-390.png` | A pot = name + image + goal; card shows "Family trip £806 / £1,000 target, 80% saved" (visible in screenshot). Monzo cites research that **visual reminders of goals reduce dipping into savings**. | A picture of the destination plus a progress bar makes saving emotional. | Very high: the core of "top up toward a trip". Goal saving is not in API — can be client-side (localStorage) for a pilot, server later. |
| **Apple Card / Apple Cash in Wallet** ([Apple support 102329](https://support.apple.com/en-us/HT209489), [Macworld](https://www.macworld.com/article/234960/how-to-get-an-accounting-of-your-apple-cash-transactions.html)) | Week/month/year toggle under the balance with comparison to the previous period; Apple Cash list criticised for lacking monthly totals. | Period grouping with totals is what makes a statement scannable. | High: group the timeline by month with in/out totals (computable client-side from loaded items). |
| **Careem Pay** (Arabic/Gulf super-app) — [help: Careem Pay credit](https://help.careem.com/hc/en-us/articles/360001585968-What-is-Careem-Pay-credit), [Khaleej Times](https://www.khaleejtimes.com/lifestyle/from-settling-phone-bills-to-automatic-salik-top-ups-careem-pay-is-here-to-simplify-your-life), screenshot `ref-careem-pay-390.png` | "Credit is like digital money stored in your account"; Careem Plus pays 10% ride cashback **directly into the wallet**; auto-recharge for Salik when low. | Clear one-sentence definition of credit; cashback lands in the wallet so the wallet keeps growing. | High for copy tone and for an "auto top-up" future feature (needs backend). |
| **STC Pay** ([App Store BH](https://apps.apple.com/app/id1336421084), [VP0 RTL clone notes](https://vp0.com/blogs/stc-pay-ui-clone-react-native)) | Arabic-first wallet; notes stress RTL mirroring and clear quotes before money moves. | Confirms RTL wallet conventions: amounts stay LTR inside RTL rows, quote before confirm. | Medium: no public design case study found (**unverified** detail). |
| **Dribbble boarding-pass concepts** ([Ryanair Labs](https://dribbble.com/RyanairLabsDesign/projects/1177423-Ryanair-Bubble), [Sajon Emirates](https://dribbble.com/sajon/projects/2155418-Boarding-Pass-App), [JetBlue reimagined](https://dribbble.com/manuela610)) | Perforated ticket stubs, tear-off micro-interactions, stacked passes paging. | A familiar travel artefact makes a financial record feel like part of the trip. | Concept-only inspiration; no wallet+boarding-pass shot found. Use the stub motif, not the full ticket chrome. |

## ui-ux-pro-max findings
- Design-system query ("fintech wallet travel rewards consumer"): pattern **Trust & Authority + Conversion**
  (transparent pricing, low-friction form, security cues); avoid "playful design + unclear fees". Its palette
  (amber/purple, IBM Plex) is ignored — Goteav tokens (navy/teal/yellow, Tajawal) are fixed.
- UX domain: label always visible on the amount input (not placeholder-only, High); locale-aware dates and
  thousand separators; empty states must carry an action; **animate 1–2 key elements per view max** and
  honour `prefers-reduced-motion` (High).
- Chart domain: for "progress toward a target" use a **bullet/progress bar with the number and target as text
  beside it**; colour alone is not enough.

## Recurring patterns (ranked by evidence)
1. **Available is the hero; held is explained, never just subtracted.** Revolut excludes held funds and gives
   each hold a resolve date; Booking/Airbnb show one spendable figure. Goteav: one big `available`, then a
   compact "held for 1 booking" chip that opens the booking and the RESERVE row. Kill the duplicate total.
2. **Movements as stories, not rows.** Wise's step tracker; Apple's period grouping with totals. Goteav: group
   RESERVE → CAPTURE/PAYMENT → RELEASE/REFUND by `reference.id` into one booking entry with steps, show
   `balanceAfter` as the running balance, month headers with in/out totals, localised type labels instead of
   backend `description`.
3. **Balance is applied automatically at checkout — say so.** Airbnb, Booking.com. Goteav: a persistent line
   "يُستخدم رصيدك تلقائيًا عند الدفع" plus a "Book with your balance" CTA.
4. **Points shown as money, side by side with cash.** Expedia (OneKeyCash vs Trip Elements), Trip.com coins
   with conversion, Booking "Rewards & Wallet" in one place, Almosafer bank points landing in the wallet.
   Goteav: a points tile with live "= $X" and a one-tap redeem into the wallet.
5. **Goal imagery drives saving.** Monzo pots (image + target + %), with research claim on visual reminders.
   Goteav: let the balance aim at a destination/trip image with a progress bar.
6. Bonus for moving value into the wallet (SAB +20% into Almosafer wallet; Careem Plus cashback to wallet) —
   strong top-up motivator but **needs backend** (top-up bonuses not in API).

## Bold ideas worth testing
Each idea lists the goals it serves (G1 top-ups · G2 trust & clarity · G3 rewards · G4 book with balance) and
the data it needs.

### 1. "Where can this take me?" — balance as a destination radar
The hero does not lead with "$250.00" alone; it pairs the number with a horizontal strip (RTL-flowing) of
destination cards whose "from" price is ≤ available ("Istanbul round-trip from $219 — covered"), and two
"almost there" cards just above the balance ("Dubai $310 — add $60"). The "add $60" chip pre-fills the top-up
amount with the exact gap.
- Serves: G4 (direct path to booking), G1 (gap-to-trip is the most concrete reason to top up), G2 (the number
  is still primary).
- Data: `GET /wallet.available`; top-up min/max from public settings (clamp the gap to min 5). Destination
  prices **need backend/verification** (reuse destinations/offers endpoint; fallback = static curated
  destinations with "from" prices clearly labelled as indicative).

### 2. Boarding-pass statement — every booking is one ticket with a tear-off stub
Transactions sharing `reference.id` (BOOKING/PAYMENT) collapse into one boarding-pass-shaped card:
the main body = booking name + final amount; the perforated stub = mini step tracker
(Held → Paid → Released/Refunded) with each step's time and `balanceAfter`. Top-ups and redemptions render
as smaller "receipt" slips in a different shape, so the eye separates "money in" from "trips". Clicking the
stub opens the booking.
- Serves: G2 strongly (ends the RESERVE+PAYMENT "double charge" confusion; ties every debit to a booking),
  G4 (each ticket links to manage/rebook).
- Data: `type`, `direction`, `amount`, `balanceAfter`, `createdAt`, `reference{id,type}`, `reversalOfId`.
  Grouping is client-side over loaded pages; a group split across cursor pages must render as "loading
  earlier steps". Booking names/route **need a lookup** (booking detail endpoint) — fallback "Booking #ref".

### 3. Journey timeline with a running-balance "altitude" line
Instead of a list, a vertical timeline (mirrors in RTL) with a thin line whose horizontal offset/altitude
follows `balanceAfter` — a flight path that climbs on top-ups/refunds/redemptions and descends on payments.
Month "airports" act as headers with in/out totals. Holds are drawn as dashed segments (money "in the air")
until RELEASE or CAPTURE lands them.
- Serves: G2 (running balance and holds are literally visible), G1 (a descending path ending near zero
  naturally invites a "refuel" top-up node at the end), G3 (redemptions appear as yellow climbs labelled
  "points → cash").
- Data: `balanceBefore`, `balanceAfter`, `createdAt`, `type`, `direction`. All present. Must have a plain
  table/list fallback and reduced-motion static rendering (ui-ux-pro-max High rules).

### 4. Two-tank gauge: cash tank + points tank with a valve
A split hero: navy "cash" tank (available, with a teal held-band on top labelled with the booking) and a
yellow "points" tank showing points and their USD equivalent. Between them a valve/slider "convert 1,200 pts →
$12" that animates value flowing into the cash tank on redeem. Top-up is a "fill" control on the cash tank
with quick chips (25 / 50 / 100 / 250, honouring min/max).
- Serves: G3 (rewards are a peer of cash, not a footnote), G1 (fill metaphor), G2 (held amount is a visible,
  labelled band, not a second total).
- Data: `/wallet` available + reserved; `/loyalty` summary (balance, rate, min redeem — verify fields);
  `/loyalty/redeem`; top-up limits. Tank visual must carry text values beside it (chart guidance).

### 5. Trip savings pot — "Save for Cairo" with the destination photo
Monzo-style goal: the traveller picks a destination (or one of their wishlisted searches) and a target; the
wallet hero shows the photo, "$250 / $640 — 39%", and suggests a top-up that reaches the next 25% milestone.
When available ≥ target, the pot turns into a "Book now with your balance" call.
- Serves: G1 (goal-driven top-ups — strongest evidence: Monzo research claim), G4 (target = a real trip),
  G2 (it is a label on the same balance, not a separate account).
- Data: available only from the API; goal storage **needs backend** — pilot can store it per-viewer client-side
  with an honest "saved on this device" note. Fare for target needs offers endpoint (verify).

### 6. Top-up "boarding gate" — amount as a trip-length dial
The top-up entry is a big Wise-style tabular number with a dial/stepper whose ticks are labelled in travel
terms computed from current balance + amount ("+$100 = enough for 2 hotel nights in Istanbul" — indicative)
and the hosted-payment trust strip (gateway logos, "you pay on the secure Stripe/MyFatoorah page"). Payment
method is chosen first (Apple Pay / Google Pay / card) — not disabled until amount is typed.
- Serves: G1 (value framing), G2 (clear hosted-redirect promise, min/max shown as gate rules), G4.
- Data: top-up limits, payment methods by purpose `WALLET_TOPUP`, `POST /wallet/top-ups`; error states
  (disabled, out of range, daily limit, payments unavailable); "nights" equivalence **needs** an indicative
  price source (or static averages, labelled).

## Anti-patterns to avoid
- Showing the same number twice ("balance" and "available") — current page problem; Revolut shows only
  available.
- Holds without the booking and without a "what happens next" — produces "double charge" complaints
  (see Revolut community threads in search results).
- Refunds silently converted to app-only credit (Hopper criticism) — label refund destination explicitly.
- Expiry pressure copy borrowed from Booking/Hopper — Goteav cash does not expire; don't imply it does.
- Raw backend English descriptions in the Arabic UI; amounts not isolated with `<bdi dir="ltr">`.
- Generic fintech dashboard charts (spending pie, card mock-ups with chip) — the current "virtual card" adds
  no information. Animate at most 1–2 elements; no motion without reduced-motion fallback.
- Disabled payment-method dropdown until amount typed (current page) — choosing order should not block.
- Placeholder-only labels on the amount field.

## Needs backend (from ideas above)
Destination/offer prices tied to balance · booking label lookup for grouped entries (or include in reference)
· hold release-by date · savings goals · top-up bonuses · auto top-up.

## Screenshots in this folder
`ref-almosafer-home-1440.png`, `ref-almosafer-home-390.png` (RTL Arabic travel site, region modal shown),
`ref-monzo-pots-1440.png`, `ref-monzo-pots-390.png` (goal pot with image, amount, target, % — cookie banner
not accepted), `ref-wise-home-1440.png`, `ref-wise-home-390.png` (large amount entry), `ref-careem-pay-390.png`
(Careem Pay landing). Hopper, Expedia (bot wall) and Revolut (challenge page) could not be captured.

## Sources
- https://awardwallet.com/travel/bookingcom-rewards/
- https://awardwallet.com/blog/how-do-bookingcom-rewards-expire/
- https://www.hoteldig.com/en/booking-com-rewards-wallet/
- https://www.airbnb.com/help/article/3446
- https://help.hopper.com/en_us/what-is-carrot-cash-HJemBY5gK.md
- https://help.hopper.com/en_us/how-can-i-use-carrot-cash-ByevPFqgF
- https://going.com/guides/how-to-use-hopper
- https://theatlasheart.com/hopper-review/
- https://www.expedia.co.nz/one-key-terms
- https://www.cnbc.com/select/expedia-one-key-rewards/
- https://www.hoteldig.com/zh-hk/trip-coins-guide/
- https://www.hoteldig.com/en/agodacash/
- https://www.almosafer.com/ar
- https://bsf.sa/english/personal/cards/credit/almosafer-visa-signature
- https://www.riyadbank.com/almosafer-your-trip-on-us
- https://www.sab.com/en/personal/c/Almosafer-9june24
- https://www.prnewswire.co.uk/news-releases/wego-launches-shopcash-an-online-shopping-cashback-rewards-and-deal-discovery-app-for-the-mena-market-896292379
- https://en.wikipedia.org/wiki/Wego.com
- https://Revolut.com/blog/post/what-does-a-pending-transaction-mean/
- https://help.revolut.com/help/card-payments-withdrawals/paying-by-card-issues/why-is-my-card-payment-pending
- https://wise.com/help/articles/2452305/how-do-i-check-my-transfers-status
- https://docs.wise.com/guides/product/send-money/tracking/transfer-statuses
- https://monzo.com/savings
- https://monzo.com/blog/2017/11/20/pots
- https://support.apple.com/en-us/HT209489
- https://www.macworld.com/article/234960/how-to-get-an-accounting-of-your-apple-cash-transactions.html
- https://help.careem.com/hc/en-us/articles/360001585968-What-is-Careem-Pay-credit
- https://www.khaleejtimes.com/lifestyle/from-settling-phone-bills-to-automatic-salik-top-ups-careem-pay-is-here-to-simplify-your-life
- https://apps.apple.com/app/id1336421084
- https://vp0.com/blogs/stc-pay-ui-clone-react-native
- https://dribbble.com/RyanairLabsDesign/projects/1177423-Ryanair-Bubble
- https://dribbble.com/sajon/projects/2155418-Boarding-Pass-App
- https://dribbble.com/manuela610
