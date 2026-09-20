---
registryKey: onecard/default
defaultKind: sole_product
researchedAt: 2026-09-20
---

# onecard/default

## Identity

- **Registry key:** `onecard/default`
- **Official product:** One Credit Card (marketed as OneCard). Issuer is a partner bank; current public MITC on getonecard.app includes **Federal Bank One Co-Branded Credit Card** (Visa / RuPay). Historically also CSB-issued variants (separate MITC hub at `/legal/mitc/`).
- **How the slug maps:** Statement mail subjects `OneCard Statement` / `One Credit Card Statement`. OneCard is the only product under this bank key.
- **defaultKind rationale:** `sole_product` — NetworthDB registers a single OneCard variant; benefits are for this product, not a generic bank fallback.

## Fees and Waivers

From Federal Bank One co-branded MITC (web + PDF, retrieved 2026-09-20):

- Joining fee: **Nil** (primary and add-on).
- Annual membership: **Nil**.
- Product page: no joining / annual / rewards-redemption fees advertised.
- Interest: **3.75% per month / 45% p.a.** on unpaid dues (w.e.f. 01.08.2024). Interest-free period up to **48 days** (PDF).
- Late payment (PDF grid): ₹0–250: ₹0; ₹251–1000: ₹250; ₹1001–5000: ₹500; ₹5001–25000: ₹1000; ₹25001+: ₹1250.
- Overlimit: **2.5% of overlimit or ₹500**, whichever higher (w.e.f. 01.08.2024); overlimit only if enabled in app.
- Forex markup: levied on FX and on INR at overseas-registered merchants (exact % in MITC fee table; PDF lists **1%** of transaction amount among transaction-based charges — table OCR is messy; treat **1% as cited in PDF row**, confirm in live MITC if using in product).
- Rent / wallet / education-style fees: MITC lists **1%** on rent and wallet; fuel surcharge **waiver** (see Exclusions).
- GST on all fees/interest.
- Metal add-on issuance ₹3000 (PDF); metal cancellation/replacement fees exist.

## Reward Currency and Base Earn

- **1 Reward Point per ₹50** spend (fractional points below ₹50).
- Categories from network MCC (dining, shopping, travel, etc.).
- **No points** on: money transfers, rent, fuel (from 15-Dec-2023), cash withdrawals, digital wallet load/top-up.

## Accelerated Earn

- **5X** on the **top 2 spend categories** in a month if you spend in **at least 3 categories**, each with **minimum ₹750** (w.e.f. 6 Jan 2025). Incremental 5X credited on the **10th of the next month**.
- Education / bills / insurance: 5X incremental capped so total rewards under those categories do not exceed **25,000 points**.
- Referral: **2,500** bonus points per activated referred user; max **25/month** and **100/year**; not eligible for 5X.

## Redemption

- **No redemption fee** (MITC + product page).
- Pay with points (swipe right) on transactions **less than 2 months old**; also app offers.
- Points **do not expire** unless: card unused **>365 days**; arrears/fraud; death; refunds reverse points; account closed.

## Lounge

- **No airport lounge access** (official blog FAQ, getonecard.app). Around You: **20% valueback up to ₹500** on selected airport dining (activate in app). Not a lounge substitute.

## Travel / Hotel / Golf / Concierge

- Around You airport dining offer (above). No complimentary golf / hotel programme found on official MITC. **unknown** beyond app offers.

## Insurance

- **unknown** on official MITC pages reviewed (no travel-insurance table in Federal One MITC extract).

## Milestones and Spend Thresholds

- 5X category rules and ₹750/category minimum (above). No spend-based annual-fee waiver (fee is nil).

## Welcome / Renewal Benefits

- Lifetime nil joining/annual. Referral bonus only (not a welcome voucher).

## Exclusions and Caps

- Fuel: surcharge waiver **min(1% of txn, actual surcharge ex-GST)**; **max ₹400 per calendar month**; **no reward points** on fuel.
- Wallet/rent: 1% fees per MITC.
- Points nullified after 365 days inactivity.

## Sources and MITC

| Source | Retrieved | Used for |
| ------ | --------- | -------- |
| https://www.getonecard.app/ | 2026-09-20 | Identity, nil fees marketing, 5X top spends |
| https://www.getonecard.app/legal/fed_mitc/ | 2026-09-20 | Fees, rewards, fuel, 5X rules |
| https://assets.getonecard.app/assets/legal/Federal_MITC.pdf | 2026-09-20 | Fee table, 48-day interest-free |
| https://www.getonecard.app/legal/mitc/ | 2026-09-20 | CSB-issued MITC hub (issuer variant) |
| https://www.getonecard.app/blog/make-airport-visits-rewarding-with-around-you/ | 2026-09-20 | No lounge; airport dining valueback |
## Changelog

- **2026-10-04:** Confidence pass — confirmed absences set to `NA` with MITC/product citations; fees, lounge, and rewards filled where issuer sources allow. `researched_at` and `updated_at` bumped.
