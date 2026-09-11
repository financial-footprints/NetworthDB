import type { Account } from "@web/utils/api/endpoints/accounts/types";
import {
  formatAccountAriaLabel,
  formatBankName,
  formatVariantLabel,
  isDefaultVariant,
} from "@web/utils/banks";
import { IconFI } from "@web/utils/icons";

type BankAccountTileProps = {
  account: Account;
};

export function BankAccountTile({ account }: BankAccountTileProps) {
  const bankName = formatBankName(account.bank);
  const variantName = formatVariantLabel(account.variant);
  const showVariant = !isDefaultVariant(account.variant);
  const ariaLabel = formatAccountAriaLabel(account);

  return (
    <article
      aria-label={ariaLabel}
      className="rounded-sm border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div className="flex items-center gap-3">
        <img src={IconFI(account.bank)} alt="" aria-hidden className="h-6 w-auto shrink-0" />

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
        {account.account_number.trim() || "—"}
      </p>
    </article>
  );
}
