import { PageHeading } from "@web/components/layout/PageHeading";
import { PageTitle } from "@web/components/layout/PageTitle";
import { path } from "@web/router/routes";
import { AccountFormModal } from "@web/routes/statements/accounts/AccountFormModal";
import { CreditCardDetailsView } from "@web/routes/statements/credit-card/details/CreditCardDetailsView";
import { SyncButton } from "@web/routes/statements/SyncButton";
import { UploadZipButton } from "@web/routes/statements/UploadZipButton";
import {
  getAccountForEdit,
  invalidateAccountDetails,
  readAccountDetails,
} from "@web/utils/api/endpoints/accounts";
import type { Account } from "@web/utils/api/endpoints/accounts/types";
import { formatAccountTitle } from "@web/utils/banks";
import { use, useState } from "react";
import { FaArrowLeft } from "react-icons/fa";
import { Link, useNavigate, useParams } from "react-router-dom";

type CreditCardDetailsContentProps = {
  onUploadSuccess: () => void;
};

export function CreditCardDetailsContent({ onUploadSuccess }: CreditCardDetailsContentProps) {
  const navigate = useNavigate();
  const { accountId } = useParams();

  if (!accountId) {
    throw new Error("Missing credit card route parameters.");
  }

  const details = use(readAccountDetails({ accountId }));

  const [showEditForm, setShowEditForm] = useState(false);
  const [editAccount, setEditAccount] = useState<Account | null>(null);

  const pageTitle = formatAccountTitle(details.account.bank, details.account.variant);

  async function openEditForm() {
    const account = await getAccountForEdit(details.account.id);
    setEditAccount(account);
    setShowEditForm(true);
  }

  return (
    <div className="mx-auto w-full max-w-4xl">
      <PageTitle page={pageTitle} />
      <Link
        to={path.statements.credit_card.list}
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
      >
        <FaArrowLeft aria-hidden />
        Back
      </Link>

      <PageHeading
        title={pageTitle}
        description="Credit card details and statement periods"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <UploadZipButton accountId={details.account.id} onUploadSuccess={onUploadSuccess} />
            <SyncButton scope="account" accountId={details.account.id} />
          </div>
        }
      />

      <CreditCardDetailsView
        details={details}
        onUploadSuccess={onUploadSuccess}
        onEdit={() => void openEditForm()}
        onAccountDeleted={() => {
          navigate(path.statements.credit_card.list);
        }}
      />

      {showEditForm && editAccount ? (
        <AccountFormModal
          accountType="credit_card"
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
