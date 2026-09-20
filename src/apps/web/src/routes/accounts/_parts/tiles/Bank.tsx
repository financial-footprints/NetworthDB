import { path } from "@web/router/routes";
import type { Account } from "@web/utils/api/routes/accounts/types";
import {
  formatAccountAriaLabel,
  formatBankName,
  formatVariantLabel,
  isDefaultVariant,
} from "@web/utils/banks";
import { bankIcon } from "@web/utils/icons";
import { formatIntegerAsRupee } from "@web/utils/money";
import { Link } from "react-router-dom";

type BankAccountTileProps = {
  account: Account;
  linkToDetail?: boolean;
};

export function Bank({ account, linkToDetail = false }: BankAccountTileProps) {
  const bankName = formatBankName(account.bank);
  const variantName = formatVariantLabel(account.variant);
  const showVariant = !isDefaultVariant(account.variant);
  const ariaLabel = formatAccountAriaLabel(account);

  const className =
    "rounded-sm border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow-md";

  const content = (
    <>
      <div className="flex items-center gap-3">
        <img src={bankIcon(account.bank)} alt="" aria-hidden className="h-6 w-auto shrink-0" />

        <div className="space-y-0.5 text-sm">
          <p>
            <span className="text-slate-400">Bank: </span>
            <span className="font-medium text-slate-700">{bankName}</span>
          </p>
          {showVariant ? (
            <p>
              <span className="text-slate-400">Variant: </span>
              <span className="font-medium text-slate-700">{variantName}</span>
            </p>
          ) : null}
        </div>
      </div>
      <p className="mt-4 font-mono text-xl font-semibold tracking-wide text-slate-900">
        {account.accountNumber.trim() || "—"}
      </p>
      <p className="mt-2 text-sm font-medium tabular-nums text-slate-600">
        ₹{formatIntegerAsRupee(account.currentBalance)}
      </p>
    </>
  );

  if (linkToDetail) {
    return (
      <Link
        to={path.accounts.details(account.id)}
        aria-label={ariaLabel}
        className={`${className} block w-full cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a5fb4]`}
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
