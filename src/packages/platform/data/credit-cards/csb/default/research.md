---
registryKey: csb/default
defaultKind: parser_fallback
researchedAt: 2026-09-20
---

# csb/default

## Identity

- **Registry key:** `csb/default`
- **Official product:** **Not mapped.** Mail subject is generic `Credit Card Statement`. Public CSB credit-card docs found are for **Edge / Edge+ CSB Bank RuPay** (Jupiter / Europa Neo), which is `csb/edge`.
- **defaultKind rationale:** `parser_fallback`. CSB does not publish a second clearly named retail CC MITC in this research pass.

## What we cannot claim

Do not copy Edge joining/annual/Jewel rules onto `csb/default`. If the user’s statement is Jupiter Edge, they should use `csb/edge`.

## Fees / Rewards / Lounge

**unknown** at bank-generic level. Only official MITC located: Edge CSB RuPay (see `csb/edge`).

## Sources and MITC

| Source | Retrieved | Used for |
| ------ | --------- | -------- |
| https://www.csb.co.in/pdf/edge-csb-bank-ruPay-credit-card-mitc_2025.pdf | 2026-09-20 | Confirms Edge/Edge+ as the documented CSB CC products |
| https://www.csb.co.in/pdf/Edge_CSB_Bank_RuPay_Credit_Card-TnC.pdf | 2026-09-20 | Edge T&C |
