import { PageBoundary } from "@web/components/layout/PageBoundary";
import { CreditCardDetailsContent } from "@web/routes/statements/credit-card/details/content";
import { DetailsErrorFallback } from "@web/routes/statements/credit-card/details/error";
import CreditCardDetailsLoading from "@web/routes/statements/credit-card/details/loading";
import { invalidateAccountDetails } from "@web/utils/api/endpoints/accounts";
import { useState } from "react";
import { useParams } from "react-router-dom";

export default function CreditCardDetailsPage() {
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
      errorTitle="Could not load credit card"
      onRetry={refreshDetails}
      loadingFallback={<CreditCardDetailsLoading />}
      errorFallback={({ error, reset }) => (
        <DetailsErrorFallback error={error} reset={reset} onRetry={refreshDetails} />
      )}
    >
      <CreditCardDetailsContent key={detailsKey} onUploadSuccess={refreshDetails} />
    </PageBoundary>
  );
}
