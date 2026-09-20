---
registryKey: yes/default
defaultKind: parser_fallback
researchedAt: 2026-09-20
---

# yes/default

## Identity

- **Registry key:** `yes/default`
- **Official product:** **Not a single card.** Mail subject is generic `Your YES_BANK`. YES BANK issues many retail cards (MARQUEE, RESERV, SELECT, ACE, RuPay, Klick, Uni, etc.).
- **defaultKind rationale:** `parser_fallback` — statements we can parse without mapping to ACE (or another named variant). Do **not** show ACE-specific earn rates as if they apply.

## What we cannot claim

Lounge visits, cashback %, welcome vouchers, and annual fees **vary by product**. Use bank-level Key Fact Statement / Schedule of Charges and tell the user to pick their actual variant (e.g. `yes/ace`).

## Fees and Waivers

Bank-level (YES BANK Key Fact Statement V_14_30-06-25), **not** one card:

- First-year / renewal fees range from **Nil** (RuPay, AI Inside) through **₹499** (ACE and others) up to **₹9,999** (MARQUEE).
- Interest-free period: **up to 50 days**.
- Revolving APR: **2.99%–3.99% p.m.** depending on variant.
- Late payment: no LPC if outstanding ≤ ₹500; else **10% of statement or ₹1350**, whichever lower.
- Cash advance: **2.5% or ₹500** (higher); facility suspended first 6 months.
- Add-on: **NIL** (up to 3).
- Rent: 1% (min ₹1 / ₹199 by amount); **3 rental txns / 30 days**.
- Wallet: min 1% of txn (other cards).
- Utility (non-MARQUEE): **1% on calendar-month utility > ₹15,000**, cap **₹3000**.
- Education via third-party apps: **1% + GST**, cap **₹5,000/month**.
- Fuel txn fee: **1% if txn > ₹10,000**, cap **₹5,000/month**.
- Fuel surcharge waiver: **1% on ₹400–₹5,000**; max waiver per cycle is **product-specific** (₹100 ACE … ₹1000 MARQUEE).
- Forex markup: **1%–3.50%** by variant.

## Reward Currency and Base Earn

- Currency: **YES Rewardz**. Accrual **product-specific**. Redemption caps for “other credit cards”: up to **70% of invoice** or **1,00,000 points/month** on flights/hotels; **50% of available points** on vouchers & statement credit.

## Accelerated Earn / Lounge / Insurance / Welcome

**unknown** at fallback level. Lounge: KFS says complimentary domestic lounge is **spend-gated** (₹35,000 previous quarter from Apr 2024; from **1 Apr 2025** thresholds by variant, e.g. SELECT/ELITE+ **₹50,000**). ACE is **not** listed in that threshold table in the extracts — do not assume ACE lounge from this file.

## Exclusions and Caps

- Rent, wallet, utility, education, fuel extra fees as above. Rewardz not awarded on rent/wallet/fuel/govt/marketing on ACE (see `yes/ace`); treat as typical YES exclusions unless MITC says otherwise.

## Sources and MITC

| Source | Retrieved | Used for |
| ------ | --------- | -------- |
| https://www.yesbank.in/content/published/api/v1.1/assets/CONT07A77C257C7A4BDD85DB97E51D2B5B8F/native/yesbank_key_fact_statement.pdf | 2026-09-20 | Bank-wide fees, lounge spend rules, ACE rows |
| https://www.yesbank.in/content/published/api/v1.1/assets/CONT5AA32E547C774006B79F54E05FE58F9E/native/ybl_soc.pdf | 2026-09-20 | Schedule of charges |
| https://www.yesbank.in/personal-banking/yes-individual/cards/credit-cards | 2026-09-20 | Card listing (page fetch failed; URL is official listing) |
