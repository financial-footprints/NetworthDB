import underConstructionIllustration from "@web/assets/images/illustrations/under-construction.svg";
import { PageBoundary } from "@web/components/layout/PageBoundary";
import { PageTitle } from "@web/components/layout/PageTitle";
import { BankAccountTile } from "@web/routes/statements/bank-account/BankAccountTile";
import Loading from "@web/routes/statements/bank-account/loading";
import { AccountsPageContent } from "@web/routes/statements/base";
import { invalidateAccounts } from "@web/utils/api/endpoints/accounts";

export default function BankAccountPage() {
  return (
    <>
      <PageTitle page="Bank Account Statements" />

      <PageBoundary
        errorTitle="Could not load bank accounts"
        onRetry={() => invalidateAccounts("bank_account")}
        loadingFallback={<Loading />}
      >
        <AccountsPageContent
          accountType="bank_account"
          headingTitle="Bank Account Statements"
          emptyTitle="Bank statements"
          emptyMessage="Add a bank account to start tracking statements."
          emptyIllustration={underConstructionIllustration}
          Tile={BankAccountTile}
        />
      </PageBoundary>
    </>
  );
}
