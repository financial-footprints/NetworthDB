import { ConfirmDeleteButton, IconActionButton } from "@web/components/Button";
import { DetailsField } from "@web/components/Fields/DetailsField";
import { Bank } from "@web/routes/accounts/_parts/tiles/Bank";
import { Card } from "@web/routes/accounts/_parts/tiles/Card";
import { deleteAccount } from "@web/utils/api/routes/accounts";
import type { AccountDetails } from "@web/utils/api/routes/accounts/types";
import { ACCOUNT_TYPE_LABELS } from "@web/utils/api/routes/accounts/types";
import { ACCOUNT_TILE_WIDTH } from "@web/utils/constants";
import { formatIntegerAsRupee } from "@web/utils/money";
import { formatAccountDateLabel } from "@web/utils/time";
import type { ReactNode } from "react";
import { LuPencil } from "react-icons/lu";

type AccountSummaryProps = {
  details: AccountDetails;
  balance: number;
  onEdit: () => void;
  onAccountDeleted: () => void;
  actions?: ReactNode;
};

export function Summary({
  details,
  balance,
  onEdit,
  onAccountDeleted,
  actions,
}: AccountSummaryProps) {
  const { account } = details;
  const tileAccount = { ...account, currentBalance: balance };

  return (
    <div>
      <section className="rounded-sm border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
          <div className="flex shrink-0 flex-col gap-4" style={{ width: ACCOUNT_TILE_WIDTH }}>
            {account.accountType === "credit_card" ? (
              <Card account={tileAccount} />
            ) : (
              <Bank account={tileAccount} />
            )}
          </div>

          <div className="flex flex-1 flex-col gap-4">
            <div className="flex items-start justify-between gap-4">
              <dl className="grid flex-1 gap-4 sm:grid-cols-2">
                <DetailsField label="Account Number" value={account.accountNumber} />
                <DetailsField
                  label="Account Type"
                  value={ACCOUNT_TYPE_LABELS[account.accountType]}
                />
                <DetailsField
                  label="Opening Date"
                  value={account.openingDate ? formatAccountDateLabel(account.openingDate) : "—"}
                />
                <DetailsField
                  label="Closing Date"
                  value={account.closingDate ? formatAccountDateLabel(account.closingDate) : "—"}
                />
                <DetailsField label="Balance" value={`₹${formatIntegerAsRupee(balance)}`} />
              </dl>

              <div className="flex shrink-0 items-center gap-1">
                <IconActionButton title="Edit Account" tone="edit" onClick={onEdit}>
                  <LuPencil className="size-4" strokeWidth={2} aria-hidden />
                </IconActionButton>
                <ConfirmDeleteButton
                  variant="icon"
                  confirmMessage={`Delete account ${account.accountNumber}? This cannot be undone.`}
                  onDelete={() => deleteAccount(account.id)}
                  onSuccess={onAccountDeleted}
                  errorMessage="Could not delete account"
                  title="Delete Account"
                  loadingLabel="Deleting Account…"
                />
              </div>
            </div>
          </div>
        </div>

        {actions}
      </section>

      <p className="mt-2 text-right text-xs text-slate-500">
        *Settings such as statement and email rules are visible when you're editing the account
      </p>
    </div>
  );
}
