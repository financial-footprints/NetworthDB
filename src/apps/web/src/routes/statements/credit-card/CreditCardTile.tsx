import { path } from "@web/router/routes";
import type { Account } from "@web/utils/api/endpoints/accounts/types";
import {
  formatAccountAriaLabel,
  formatBankName,
  formatVariantLabel,
  getCardGradient,
  isDefaultVariant,
  usesInvertedCardLogo,
} from "@web/utils/banks";
import { IconFI } from "@web/utils/icons";
import { Link } from "react-router-dom";

type CreditCardTileProps = {
  account: Account;
  linkToDetail?: boolean;
};

export function CreditCardTile({ account, linkToDetail = false }: CreditCardTileProps) {
  const bankName = formatBankName(account.bank);
  const isDefault = isDefaultVariant(account.variant);
  const variantName = formatVariantLabel(account.variant);
  const gradient = getCardGradient(account.bank, account.variant);
  const invertLogo = usesInvertedCardLogo(account.bank);
  const displayNumber = account.account_number.trim();
  const cardNumber = displayNumber ? formatAccountNumber(displayNumber) : "•••• •••• •••• ••••";
  const ariaLabel = formatAccountAriaLabel(account);

  const className = `group relative aspect-[1.586/1] overflow-hidden rounded-lg bg-linear-to-br ${gradient} p-4 text-white shadow-lg ring-1 ring-white/20 transition-all duration-300 ease-out hover:-translate-y-1 hover:scale-[1.04] hover:shadow-2xl hover:ring-white/30`;

  const content = (
    <>
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgba(255,255,255,0.18),transparent_55%),linear-gradient(to_bottom_right,rgba(255,255,255,0.08),transparent,rgba(0,0,0,0.2))]"
        aria-hidden
      />

      <div className="relative z-10 flex items-start justify-between">
        <div
          aria-hidden
          className="flex h-7 w-9 shrink-0 flex-col justify-center gap-0.75 rounded-none bg-linear-to-br from-[#e8c547] via-[#d4a82a] to-[#b8860b] p-1 shadow-sm ring-1 ring-[#b8860b]/50"
        >
          <div className="h-0.5 rounded-full bg-[#c9a227]/60" />
          <div className="h-0.5 rounded-full bg-[#c9a227]/40" />
          <div className="h-0.5 rounded-full bg-[#c9a227]/60" />
        </div>
        <img
          src={IconFI(account.bank)}
          alt=""
          aria-hidden
          className={`h-8 w-auto max-w-22 shrink-0 object-contain object-right drop-shadow-[0_2px_6px_rgba(0,0,0,0.35)] ${
            invertLogo ? "brightness-0 invert" : "mix-blend-multiply"
          }`}
        />
      </div>

      <div
        className="pointer-events-none absolute inset-x-0 top-[30%] h-7 bg-linear-to-b from-zinc-800 via-zinc-950 to-black"
        aria-hidden
      />

      <div className="absolute inset-x-4 bottom-4 z-10 space-y-1.5">
        {isDefault ? (
          <p className="text-sm font-semibold tracking-wide text-white/95">{bankName}</p>
        ) : (
          <div className="space-y-0.5">
            <p className="text-sm font-semibold tracking-wide text-white/95">{variantName}</p>
            <p className="text-xs font-medium tracking-wider text-white/60">{bankName}</p>
          </div>
        )}

        <p
          className={`font-mono font-semibold tabular-nums text-white/95 ${cardNumberClass(cardNumber)}`}
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
        to={path.statements.credit_card.get(account.id)}
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
