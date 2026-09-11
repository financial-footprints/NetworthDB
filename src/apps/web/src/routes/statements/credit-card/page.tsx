import creditCardIllustration from "@web/assets/images/illustrations/credit-card.svg";
import { PageBoundary } from "@web/components/layout/PageBoundary";
import { PageTitle } from "@web/components/layout/PageTitle";
import { AccountsPageContent } from "@web/routes/statements/base";
import { CreditCardTile } from "@web/routes/statements/credit-card/CreditCardTile";
import { CREDIT_CARD_GRID } from "@web/routes/statements/credit-card/constants";
import Loading from "@web/routes/statements/credit-card/loading";
import { SyncButton } from "@web/routes/statements/SyncButton";
import { invalidateAccounts } from "@web/utils/api/endpoints/accounts";

export default function CreditCardPage() {
  return (
    <div className="mx-auto w-full max-w-6xl">
      <PageTitle page="Credit Card Statements" />

      <PageBoundary
        errorTitle="Could not load credit cards"
        onRetry={() => invalidateAccounts("credit_card")}
        loadingFallback={<Loading />}
      >
        <AccountsPageContent
          accountType="credit_card"
          headingTitle="Credit Card Statements"
          emptyTitle="No credit cards configured"
          emptyMessage="Add a credit card account to start tracking statements."
          emptyIllustration={creditCardIllustration}
          gridClassName={CREDIT_CARD_GRID}
          listWrapperClassName="w-full"
          Tile={(props) => <CreditCardTile {...props} linkToDetail />}
          extraActions={<SyncButton scope="all_credit_cards" />}
        />
      </PageBoundary>
    </div>
  );
}
