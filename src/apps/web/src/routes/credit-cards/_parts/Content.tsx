import { PageBoundary } from "@web/components/Layout/PageBoundary";
import { PageHeading } from "@web/components/Layout/PageHeading";
import { PageTitle } from "@web/components/Layout/PageTitle";
import { Matrix } from "@web/routes/credit-cards/_parts/Matrix";
import type { CardCatalog } from "@web/utils/api/routes/credit-cards";
import { fetchCreditCardCatalogBulk } from "@web/utils/api/routes/credit-cards";
import { type CreditCardsHubQuery, parseCreditCardsHubQuery } from "@web/utils/credit-cards/query";
import { errorMessage } from "@web/utils/errors";
import { patchUrlParams } from "@web/utils/list";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

function hubQueryToParams(query: CreditCardsHubQuery): Record<string, string | null> {
  return {
    card: query.card ?? null,
    excludeSections: query.excludeSections?.length ? query.excludeSections.join(",") : null,
    excludeBanks: query.excludeBanks?.length ? query.excludeBanks.join(",") : null,
    parserFallback: query.parserFallback ? "1" : null,
  };
}

export function Content() {
  const [searchParams, setSearchParams] = useSearchParams();
  const hubQuery = parseCreditCardsHubQuery(searchParams);

  const [catalogs, setCatalogs] = useState<CardCatalog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCatalogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await fetchCreditCardCatalogBulk();
      setCatalogs(items);
    } catch (err: unknown) {
      setError(errorMessage(err, "Could not load card catalogs"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCatalogs();
  }, [loadCatalogs]);

  const setHubQuery = useCallback(
    (query: CreditCardsHubQuery) => {
      setSearchParams((current) => patchUrlParams(current, hubQueryToParams(query)), {
        replace: true,
      });
    },
    [setSearchParams]
  );

  return (
    <div className="mx-auto w-full max-w-[100rem] px-1">
      <PageTitle page="Credit Card Benefits" />
      <PageBoundary
        errorTitle="Could not load credit card benefits"
        onRetry={() => void loadCatalogs()}
      >
        <PageHeading
          title="Credit Card Benefits"
          description="Compare researched cards side by side in one table."
        />

        {loading ? (
          <p className="text-sm text-slate-500">Loading catalogs…</p>
        ) : error ? (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : (
          <Matrix catalogs={catalogs} hubQuery={hubQuery} onHubQueryChange={setHubQuery} />
        )}
      </PageBoundary>
    </div>
  );
}
