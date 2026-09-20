/**
 * Manually approved UI titles for credit card catalogs (`display_name` in each catalog.json).
 *
 * Do NOT change these strings when refreshing benefits from MITC or issuer product pages.
 * Issuer marketing titles are not the source of truth for NetworthDB display names.
 *
 * To rename a card intentionally: edit the variant's catalog.json, bump `updated_at`, and
 * update this map in the same change. `display-names.test.ts` enforces a exact match.
 */
export const APPROVED_CATALOG_DISPLAY_NAMES: Record<string, string> = {
  "bob/default": "BOB Credit Card",
  "bob/easy": "Easy Shopping",
  "csb/default": "CSB Credit Card",
  "csb/edge": "Jupiter Edge+",
  "federal/default": "Federal Credit Card",
  "federal/edge": "Jupiter Edge",
  "federal/signet": "Signet",
  "hdfc/default": "HDFC Bank Credit Card",
  "hdfc/diners-privilege": "Diners Privilege",
  "hdfc/regalia": "Regalia",
  "hdfc/regalia-gold": "Regalia Gold",
  "hdfc/swiggy": "Swiggy",
  "hdfc/tata-neu-infinity": "Tata Neu Infinity",
  "icici/amazon": "Amazon Pay",
  "icici/coral": "Coral",
  "icici/default": "ICICI Bank Credit Card",
  "icici/platinum": "Platinum Chip",
  "idfc/default": "IDFC FIRST Credit Card",
  "idfc/wow": "IDFC Wow!",
  "indusind/amex-epay": "ePay Amex",
  "indusind/auraedge": "Platinum Aura Edge",
  "indusind/default": "IndusInd Credit Card",
  "onecard/default": "OneCard",
  "pnb/default": "PNB Credit Card",
  "pnb/platinum": "Platinum",
  "yes/ace": "Ace",
  "yes/default": "YES Bank Credit Card",
};
