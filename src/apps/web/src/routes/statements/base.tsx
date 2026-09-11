import defaultEmptyIllustration from "@web/assets/images/illustrations/empty.svg";
import { PrimaryButton } from "@web/components/button";
import { PageHeading } from "@web/components/layout/PageHeading";
import { StatusView } from "@web/components/layout/StatusView";
import { AccountFormModal } from "@web/routes/statements/accounts/AccountFormModal";
import { useAccounts } from "@web/utils/api/endpoints/accounts";
import type { Account, AccountType } from "@web/utils/api/endpoints/accounts/types";
import { type ComponentType, type ReactNode, useState } from "react";

type AccountTileProps = {
  account: Account;
};

type AccountsPageContentProps = {
  accountType: AccountType;
  emptyTitle: string;
  emptyMessage: string;
  emptyIllustration?: string;
  Tile: ComponentType<AccountTileProps>;
  headingTitle?: string;
  extraActions?: ReactNode;
  gridClassName?: string;
  listWrapperClassName?: string;
};

const DEFAULT_GRID_CLASS_NAME = "grid gap-4 sm:grid-cols-2 lg:grid-cols-3";
const DEFAULT_LIST_WRAPPER_CLASS_NAME = "mx-auto w-full max-w-4xl";

export function AccountsPageContent({
  accountType,
  emptyTitle,
  emptyMessage,
  emptyIllustration = defaultEmptyIllustration,
  Tile,
  headingTitle,
  extraActions,
  gridClassName = DEFAULT_GRID_CLASS_NAME,
  listWrapperClassName = DEFAULT_LIST_WRAPPER_CLASS_NAME,
}: AccountsPageContentProps) {
  const { accounts } = useAccounts(accountType);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const addButton = (
    <PrimaryButton onClick={() => setShowCreateForm(true)}>Add Account</PrimaryButton>
  );

  const actions = (
    <div className="flex flex-wrap items-center gap-2">
      {addButton}
      {extraActions}
    </div>
  );

  return (
    <>
      {headingTitle ? (
        <PageHeading title={headingTitle} action={actions} />
      ) : (
        <div className="mb-4 flex justify-end gap-2">{actions}</div>
      )}
      {accounts.length === 0 ? (
        <StatusView illustration={emptyIllustration} title={emptyTitle} message={emptyMessage} />
      ) : (
        <div className={listWrapperClassName}>
          <div className={gridClassName}>
            {accounts.map((account) => (
              <Tile key={account.id} account={account} />
            ))}
          </div>
        </div>
      )}
      {showCreateForm ? (
        <AccountFormModal
          accountType={accountType}
          mode="create"
          onClose={() => setShowCreateForm(false)}
          onSaved={() => {
            setShowCreateForm(false);
          }}
        />
      ) : null}
    </>
  );
}
