import { resolveCreditCardCatalogTitle } from "@ndb/platform";
import type { Account } from "@web/utils/api/routes/accounts/types";
import { capitalize } from "@web/utils/strings";

const BANK_DISPLAY_NAMES: Record<string, string> = {
  bob: "Bank of Baroda",
  csb: "Catholic Syrian Bank",
  federal: "Federal Bank",
  hdfc: "HDFC Bank",
  icici: "ICICI Bank",
  idfc: "IDFC FIRST Bank",
  indusind: "IndusInd Bank",
  onecard: "OneCard",
  pnb: "Punjab National Bank",
  sbi: "State Bank of India",
  yes: "YES Bank",
};

const CARD_BANK_GRADIENTS: Record<string, string> = {
  hdfc: "from-blue-800 via-blue-900 to-slate-950",
  icici: "from-sky-900 via-blue-950 to-indigo-950",
  federal: "from-amber-800 via-orange-950 to-slate-950",
  bob: "from-blue-700 via-blue-900 to-indigo-950",
  pnb: "from-blue-600 via-indigo-800 to-slate-950",
  sbi: "from-blue-700 via-blue-950 to-slate-950",
  idfc: "from-sky-800 via-blue-950 to-slate-950",
  yes: "from-purple-800 via-violet-950 to-slate-950",
  indusind: "from-teal-800 via-cyan-950 to-slate-950",
  csb: "from-emerald-700 via-teal-900 to-slate-950",
  onecard: "from-violet-600 via-indigo-700 to-blue-800",
};

const CARD_VARIANT_GRADIENTS: Record<string, string> = {
  "hdfc:regalia-gold": "from-amber-500 via-yellow-700 to-amber-950",
  "hdfc:regalia": "from-slate-600 via-slate-800 to-slate-950",
  "hdfc:diners-privilege": "from-fuchsia-900 via-violet-900 to-fuchsia-950",
  "idfc:wow": "from-emerald-800 via-teal-950 to-slate-950",
};

const CARD_FALLBACK_GRADIENTS = [
  "from-indigo-800 via-indigo-950 to-slate-950",
  "from-sky-800 via-blue-950 to-slate-950",
  "from-fuchsia-800 via-purple-950 to-slate-950",
  "from-cyan-800 via-teal-950 to-slate-950",
  "from-amber-800 via-orange-950 to-slate-950",
  "from-rose-800 via-pink-950 to-slate-950",
];

export function formatBankName(bank: string): string {
  const key = bank.trim().toLowerCase();
  if (key in BANK_DISPLAY_NAMES) return BANK_DISPLAY_NAMES[key];
  return capitalize(key) ?? bank;
}

export function isDefaultVariant(
  variant: string | null | undefined
): variant is null | undefined | "" {
  return !variant || variant.toLowerCase() === "default";
}

export function formatVariantLabel(variant: string | null | undefined): string {
  if (isDefaultVariant(variant)) {
    return "";
  }
  return capitalize(variant) ?? "";
}

export function formatAccountTitle(bank: string, variant: string | null): string {
  if (isDefaultVariant(variant)) {
    return formatBankName(bank);
  }
  const variantLabel = formatVariantLabel(variant);
  return variantLabel ? `${formatBankName(bank)}: ${variantLabel}` : formatBankName(bank);
}

export function formatAccountAriaLabel(
  account: Account,
  catalogTitles?: ReadonlyMap<string, string>
): string {
  const catalogTitle =
    account.accountType === "credit_card" && catalogTitles
      ? resolveCreditCardCatalogTitle(account.bank, account.variant, catalogTitles)
      : null;
  const title = catalogTitle || account.label || formatAccountTitle(account.bank, account.variant);
  const number = account.accountNumber.trim();
  if (!number) {
    return title;
  }
  return `${title}, account number ${number}`;
}

export function getCardGradient(bank: string, variant: string | null): string {
  const bankKey = bank.toLowerCase();
  const variantKey = variant ? `${bankKey}:${variant.toLowerCase()}` : null;

  if (variantKey && CARD_VARIANT_GRADIENTS[variantKey]) {
    return CARD_VARIANT_GRADIENTS[variantKey];
  }
  if (CARD_BANK_GRADIENTS[bankKey]) {
    return CARD_BANK_GRADIENTS[bankKey];
  }

  let hash = 0;
  for (let i = 0; i < bankKey.length; i++) {
    hash = (hash << 5) - hash + bankKey.charCodeAt(i);
    hash |= 0;
  }
  return CARD_FALLBACK_GRADIENTS[Math.abs(hash) % CARD_FALLBACK_GRADIENTS.length];
}

export function usesInvertedCardLogo(bank: string): boolean {
  return bank.toLowerCase() === "onecard";
}
