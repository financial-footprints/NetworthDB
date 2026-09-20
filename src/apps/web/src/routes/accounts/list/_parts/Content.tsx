import defaultEmptyIllustration from "@web/assets/images/illustrations/empty.svg";
import { PrimaryButton } from "@web/components/Button";
import { PageHeading } from "@web/components/Layout/PageHeading";
import { StatusView } from "@web/components/Layout/StatusView";
import { Modal } from "@web/routes/accounts/_parts/form/Modal";
import type { Account } from "@web/utils/api/routes/accounts/types";
import { type ComponentType, type ReactNode, useState } from "react";

type AccountTileProps = {
  account: Account;
  linkToDetail?: boolean;
};

type AccountsListContentProps = {
  accounts: Account[];
  emptyTitle: string;
  emptyMessage: string;
  emptyIllustration?: string;
  Tile: ComponentType<AccountTileProps>;
  headingTitle?: string;
  toolbar?: ReactNode;
  gridClassName?: string;
  listWrapperClassName?: string;
};

const DEFAULT_GRID_CLASS_NAME = "grid gap-4 sm:grid-cols-2 lg:grid-cols-3";
const DEFAULT_LIST_WRAPPER_CLASS_NAME = "mx-auto w-full max-w-4xl";

export function Content({
  accounts,
  emptyTitle,
  emptyMessage,
  emptyIllustration = defaultEmptyIllustration,
  Tile,
  headingTitle,
  toolbar,
  gridClassName = DEFAULT_GRID_CLASS_NAME,
  listWrapperClassName = DEFAULT_LIST_WRAPPER_CLASS_NAME,
}: AccountsListContentProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);

  const addButton = (
    <PrimaryButton onClick={() => setShowCreateForm(true)}>Add Account</PrimaryButton>
  );

  const headingAction = toolbar ? (
    <div className="flex flex-wrap items-center gap-2">
      {addButton}
      {toolbar}
    </div>
  ) : (
    addButton
  );

  return (
    <>
      {headingTitle ? (
        <PageHeading title={headingTitle} action={headingAction} />
      ) : (
        <div className="mb-4 flex justify-end gap-2">{headingAction}</div>
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
        <Modal
          accountType="bank"
          mode="create"
          pickAccountType
          onClose={() => setShowCreateForm(false)}
          onSaved={() => {
            setShowCreateForm(false);
          }}
        />
      ) : null}
    </>
  );
}
