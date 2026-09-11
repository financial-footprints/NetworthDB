import { PageHeading } from "@web/components/layout/PageHeading";
import { Skeleton } from "@web/components/loading/Skeleton";
import { SkeletonStatus } from "@web/components/loading/SkeletonStatus";
import { CREDIT_CARD_GRID } from "@web/routes/statements/credit-card/constants";
import { SyncButton } from "@web/routes/statements/SyncButton";

const LOADING_CARD_KEYS = ["card-a", "card-b", "card-c", "card-d"] as const;

function CreditCardTileSkeleton() {
  return <Skeleton className="aspect-[1.586/1] w-full rounded-lg" />;
}

export default function Loading() {
  return (
    <div className="w-full">
      <PageHeading
        title="Credit Card Statements"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <SyncButton scope="all_credit_cards" />
          </div>
        }
      />
      <SkeletonStatus label="Loading credit cards">
        <div className={CREDIT_CARD_GRID}>
          {LOADING_CARD_KEYS.map((key) => (
            <CreditCardTileSkeleton key={key} />
          ))}
        </div>
      </SkeletonStatus>
    </div>
  );
}
