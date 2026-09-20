import { resolveCreditCardCatalogTitle } from "@ndb/platform";
import { PageHeading } from "@web/components/Layout/PageHeading";
import { PageTitle } from "@web/components/Layout/PageTitle";
import { useCreditCardCatalogTitles } from "@web/hooks/credit-card-titles";
import { path } from "@web/router/routes";
import { Modal } from "@web/routes/accounts/_parts/form/Modal";
import { Ledger } from "@web/routes/accounts/details/_parts/ledger/Ledger";
import { QuickActions } from "@web/routes/accounts/details/_parts/QuickActions";
import { Summary } from "@web/routes/accounts/details/_parts/Summary";
import {
  invalidateAccountDetails,
  readAccountBalance,
  readAccountDetails,
} from "@web/utils/api/routes/accounts";
import type { Account } from "@web/utils/api/routes/accounts/types";
import { isSystemAccountType, supportsStatements } from "@web/utils/api/routes/accounts/types";
import { formatAccountTitle } from "@web/utils/banks";
import { todayAccountDate } from "@web/utils/time";
import { use, useState } from "react";
import { FaArrowLeft } from "react-icons/fa";
import { Link, useNavigate, useParams } from "react-router-dom";

type AccountDetailsContentProps = {
  onUploadSuccess: () => void;
};

export function Content({ onUploadSuccess }: AccountDetailsContentProps) {
  const navigate = useNavigate();
  const { accountId } = useParams();

  if (!accountId) {
    throw new Error("Missing account route parameters.");
  }

  const detailsPromise = readAccountDetails({ accountId });
  const on = todayAccountDate();
  const balancePromise = readAccountBalance(accountId, on);
  const details = use(detailsPromise);
  const { balance } = use(balancePromise);

  const [showEditForm, setShowEditForm] = useState(false);
  const [editAccount, setEditAccount] = useState<Account | null>(null);

  const catalogTitles = useCreditCardCatalogTitles();
  const systemAccount = isSystemAccountType(details.account.accountType);
  const statementCapable = supportsStatements(details.account.accountType);
  const creditCardAccount = details.account.accountType === "credit_card";
  const catalogTitle = creditCardAccount
    ? resolveCreditCardCatalogTitle(details.account.bank, details.account.variant, catalogTitles)
    : null;
  const pageTitle = systemAccount
    ? details.account.label
    : (catalogTitle ?? formatAccountTitle(details.account.bank, details.account.variant));

  function openEditForm() {
    setEditAccount(details.account);
    setShowEditForm(true);
  }

  return (
    <div className="mx-auto w-full max-w-6xl">
      <PageTitle page={pageTitle} />
      <Link
        to={path.accounts.list}
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
      >
        <FaArrowLeft aria-hidden />
        Back
      </Link>

      <PageHeading
        title={pageTitle}
        description={systemAccount ? "System ledger" : "Account details and transactions"}
      />

      <div className="space-y-8">
        {systemAccount ? null : (
          <Summary
            details={details}
            balance={balance}
            onEdit={openEditForm}
            onAccountDeleted={() => {
              navigate(path.accounts.list);
            }}
            actions={
              <QuickActions
                accountId={accountId}
                statementCapable={statementCapable}
                creditCardAccount={creditCardAccount}
                bank={details.account.bank}
                variant={details.account.variant}
              />
            }
          />
        )}

        <Ledger accountId={accountId} details={details} onChanged={onUploadSuccess} />
      </div>

      {showEditForm && editAccount ? (
        <Modal
          accountType={details.account.accountType}
          mode="edit"
          initialAccount={editAccount}
          accountId={accountId}
          onClose={() => {
            setShowEditForm(false);
            setEditAccount(null);
          }}
          onSaved={() => {
            invalidateAccountDetails({ accountId });
            onUploadSuccess();
          }}
        />
      ) : null}
    </div>
  );
}
