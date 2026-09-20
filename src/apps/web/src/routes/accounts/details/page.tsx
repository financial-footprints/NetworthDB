import { PageBoundary } from "@web/components/Layout/PageBoundary";
import { Content } from "@web/routes/accounts/details/_parts/Content";
import { DetailsErrorFallback } from "@web/routes/accounts/details/error";
import AccountDetailsLoading from "@web/routes/accounts/details/suspense";
import { invalidateAccountDetails } from "@web/utils/api/routes/accounts";
import { useState } from "react";
import { useParams } from "react-router-dom";

export default function AccountDetailsPage() {
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
      errorTitle="Could not load account"
      onRetry={refreshDetails}
      loadingFallback={<AccountDetailsLoading />}
      errorFallback={({ error, reset }) => (
        <DetailsErrorFallback error={error} reset={reset} onRetry={refreshDetails} />
      )}
    >
      <Content key={detailsKey} onUploadSuccess={refreshDetails} />
    </PageBoundary>
  );
}
