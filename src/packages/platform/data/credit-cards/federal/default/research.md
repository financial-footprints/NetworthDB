---
registryKey: federal/default
defaultKind: parser_fallback
researchedAt: 2026-09-20
---

# federal/default

## Identity

- **Registry key:** `federal/default`
- **Official product:** **Not a single card.** Mail: `Federal Bank Credit Card Statement`. Federal’s own range includes **Signet, Imperio, Celesta** (plus Wave, Scapia, Edge cobrand). Named keys in this repo: `federal/signet`, `federal/edge`.
- **defaultKind rationale:** `parser_fallback`. Bank MITC covers Signet/Imperio/Celesta together; do not pick Signet lounge/rewards unless the account is `signet`.

## What we cannot claim

Signet’s ₹750 fee, 1 RP / ₹200, and product-page lounge/vouchers are **Signet-specific**. Imperio/Celesta have different fees and earn rates.

## Fees and Waivers (bank MITC family)

Federal Bank MITC (Signet / Imperio / Celesta):

- Interest-free: **up to 50 days**. MAD: **5% or ₹100**.
- Annual: Signet **₹750**, Imperio **₹1500**, Celesta **₹3000**.
- Next-year waiver if spend (ex cash): Signet **₹75,000**, Imperio **₹1,50,000**, Celesta **₹3,00,000**.
- Dynamic APR from **5.88%–41.88%** based on Federal operative-account AMB; no operative account → **41.88%**.
- Forex: Signet/Imperio **3.5%**, Celesta **2%**.
- Fuel surcharge waiver: **Imperio and Celesta** 1% on ₹400–₹5000, max **₹150/month** — **not listed for Signet in that MITC row**.
- Reward redemption fee **₹99**.

## Rewards (if unknown variant)

MITC: Signet 1 RP / ₹200; Imperio 1 / ₹150; Celesta 1 / ₹100. No RP on cash, fuel, e-wallet load.

## Lounge

Product listing (federalbank.co.in/credit-cards) markets lounge on Signet. **Quota unknown** in MITC PDF. Do not assign lounge to `default`.

## Sources and MITC

| Source | Retrieved | Used for |
| ------ | --------- | -------- |
| Federal Bank MITC PDF (Most Important Terms and Conditions – Credit Cards) | 2026-09-20 | Family fees, RP rates |
| https://www.federalbank.co.in/credit-cards | 2026-09-20 | Product list (fetch 403; snippets from search) |
| https://www.federalbank.co.in/documents/10180/81307/Service+charges+and+Fees-+Credit+Card.pdf | 2026-09-20 | Charges table |
