import { resolveCreditCardCatalogTitle } from "@ndb/platform";
import { useCreditCardCatalogTitles } from "@web/hooks/credit-card-titles";
import { path } from "@web/router/routes";
import type { Account } from "@web/utils/api/routes/accounts/types";
import {
  formatAccountAriaLabel,
  formatBankName,
  formatVariantLabel,
  getCardGradient,
  isDefaultVariant,
  usesInvertedCardLogo,
} from "@web/utils/banks";
import { bankIcon } from "@web/utils/icons";
import { formatIntegerAsRupee } from "@web/utils/money";
import { Link } from "react-router-dom";

type CreditCardTileProps = {
  account: Account;
  linkToDetail?: boolean;
};

export function Card({ account, linkToDetail = false }: CreditCardTileProps) {
  const catalogTitles = useCreditCardCatalogTitles();
  const catalogTitle = resolveCreditCardCatalogTitle(account.bank, account.variant, catalogTitles);
  const bankName = formatBankName(account.bank);
  const isDefault = isDefaultVariant(account.variant) && !catalogTitle;
  const variantName = catalogTitle || formatVariantLabel(account.variant);
  const gradient = getCardGradient(account.bank, account.variant);
  const invertLogo = usesInvertedCardLogo(account.bank);
  const displayNumber = account.accountNumber.trim();
  const cardNumber = displayNumber ? formatAccountNumber(displayNumber) : "•••• •••• •••• ••••";
  const ariaLabel = formatAccountAriaLabel(account, catalogTitles);

  const className = `group relative flex aspect-[1.586/1] flex-col overflow-hidden rounded-lg bg-linear-to-br ${gradient} p-4 text-white shadow-lg ring-1 ring-white/20 transition-all duration-300 ease-out hover:-translate-y-1 hover:scale-[1.04] hover:shadow-2xl hover:ring-white/30`;

  const content = (
    <>
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgba(255,255,255,0.18),transparent_55%),linear-gradient(to_bottom_right,rgba(255,255,255,0.08),transparent,rgba(0,0,0,0.2))]"
        aria-hidden
      />

      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <div
            aria-hidden
            className="flex h-7 w-9 shrink-0 flex-col justify-center gap-0.75 rounded-none bg-linear-to-br from-[#e8c547] via-[#d4a82a] to-[#b8860b] p-1 shadow-sm ring-1 ring-[#b8860b]/50"
          >
            <div className="h-0.5 rounded-full bg-[#c9a227]/60" />
            <div className="h-0.5 rounded-full bg-[#c9a227]/40" />
            <div className="h-0.5 rounded-full bg-[#c9a227]/60" />
          </div>
          <div className="flex min-w-0 flex-col items-end gap-1">
            <div className="flex h-8 items-center justify-end" aria-hidden>
              <img
                src={bankIcon(account.bank)}
                alt=""
                className={`h-8 w-auto object-contain object-right drop-shadow-[0_2px_6px_rgba(0,0,0,0.35)] ${
                  invertLogo ? "brightness-0 invert" : "mix-blend-multiply"
                }`}
              />
            </div>
            <p className="text-xs font-semibold tabular-nums text-white/90">
              ₹{formatIntegerAsRupee(account.currentBalance)}
            </p>
          </div>
        </div>

        <div className="mt-2 flex min-h-0 min-w-0 flex-1 flex-col justify-end pb-1">
          {isDefault ? (
            <p className="truncate text-sm font-semibold leading-snug tracking-wide text-white/95">
              {bankName}
            </p>
          ) : (
            <div className="min-w-0 space-y-0.5">
              <p className="truncate text-sm font-semibold leading-snug tracking-wide text-white/95">
                {variantName}
              </p>
              <p className="truncate text-xs font-medium leading-snug tracking-wider text-white/65">
                {bankName}
              </p>
            </div>
          )}
        </div>

        <div
          className="-mx-4 h-6 shrink-0 bg-linear-to-b from-zinc-800 via-zinc-950 to-black"
          aria-hidden
        />

        <p
          className={`truncate whitespace-nowrap pt-2 font-mono font-semibold tabular-nums text-white/95 ${cardNumberClass(cardNumber)}`}
          style={{
            textShadow: "0 1px 1px rgba(0,0,0,0.4), 0 -1px 0 rgba(255,255,255,0.1)",
          }}
        >
          {cardNumber}
        </p>
      </div>
    </>
  );

  if (linkToDetail) {
    return (
      <Link
        to={path.accounts.details(account.id)}
        aria-label={ariaLabel}
        className={`${className} block w-full cursor-pointer rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white`}
      >
        {content}
      </Link>
    );
  }

  return (
    <article aria-label={ariaLabel} className={`${className} w-full`}>
      {content}
    </article>
  );
}

function formatAccountNumber(accountNumber: string): string {
  const n = accountNumber.replace(/\s+/g, "").toUpperCase();
  if (!n) return accountNumber;
  if (/^\d{4}$/.test(n)) return `•••• •••• •••• ${n}`;
  return (n.match(/.{1,4}/g) ?? [accountNumber]).join(" ");
}

function cardNumberClass(formattedNumber: string): string {
  const len = formattedNumber.length;
  if (len > 22) return "text-[11px]";
  if (len > 19) return "text-xs";
  return "text-sm";
}
