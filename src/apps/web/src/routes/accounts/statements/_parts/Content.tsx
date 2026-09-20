import { PageHeading } from "@web/components/Layout/PageHeading";
import { PageTitle } from "@web/components/Layout/PageTitle";
import { path } from "@web/router/routes";
import { SyncButton } from "@web/routes/accounts/_parts/SyncButton";
import { Calendar } from "@web/routes/accounts/statements/_parts/Calendar";
import { UploadZipButton } from "@web/routes/accounts/statements/_parts/UploadZipButton";
import { readAccountDetails } from "@web/utils/api/routes/accounts";
import { ACCOUNT_TYPE_LABELS } from "@web/utils/api/routes/accounts/types";
import { formatAccountTitle } from "@web/utils/banks";
import { use } from "react";
import { FaArrowLeft } from "react-icons/fa";
import { Link, useParams } from "react-router-dom";

type AccountStatementsContentProps = {
  onUploadSuccess: () => void;
};

export function Content({ onUploadSuccess }: AccountStatementsContentProps) {
  const { accountId } = useParams();

  if (!accountId) {
    throw new Error("Missing account statements route parameters.");
  }

  const details = use(readAccountDetails({ accountId }));

  const pageTitle = formatAccountTitle(details.account.bank, details.account.variant);
  const typeLabel = ACCOUNT_TYPE_LABELS[details.account.accountType];

  return (
    <div className="mx-auto w-full max-w-4xl">
      <PageTitle page={`${pageTitle} — Statements`} />
      <Link
        to={path.accounts.details(accountId)}
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
      >
        <FaArrowLeft aria-hidden />
        Back to account
      </Link>

      <PageHeading
        title={`${pageTitle} — Statements`}
        description={`${typeLabel}. Statement files, coverage, and calendar.`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <UploadZipButton accountId={details.account.id} onUploadSuccess={onUploadSuccess} />
            <SyncButton
              scope="account"
              accountId={details.account.id}
              onSyncSettled={onUploadSuccess}
            />
          </div>
        }
      />

      <Calendar details={details} onUploadSuccess={onUploadSuccess} />
    </div>
  );
}
