import { PageBoundary } from "@web/components/Layout/PageBoundary";
import { DetailsErrorFallback } from "@web/routes/accounts/details/error";
import { Content } from "@web/routes/accounts/statements/_parts/Content";
import AccountStatementsLoading from "@web/routes/accounts/statements/suspense";
import { invalidateAccountDetails } from "@web/utils/api/routes/accounts";
import { useState } from "react";
import { useParams } from "react-router-dom";

export default function AccountStatementsPage() {
  const { accountId } = useParams();
  const [detailsKey, setDetailsKey] = useState(0);

  function refreshDetails() {
    if (accountId) {
      invalidateAccountDetails({ accountId });
    }
    setDetailsKey((key) => key + 1);
  }

  return (
    <PageBoundary
      errorTitle="Could not load account statements"
      onRetry={refreshDetails}
      loadingFallback={<AccountStatementsLoading />}
      errorFallback={({ error, reset }) => (
        <DetailsErrorFallback error={error} reset={reset} onRetry={refreshDetails} />
      )}
    >
      <Content key={detailsKey} onUploadSuccess={refreshDetails} />
    </PageBoundary>
  );
}
