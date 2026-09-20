import { SecondaryButton } from "@web/components/Button";
import { PageTitle } from "@web/components/Layout/PageTitle";
import { useActivePeriod } from "@web/contexts/ActivePeriod/Context";
import { Dashboard } from "@web/routes/home/_parts/Dashboard";
import { DashboardPageSkeleton } from "@web/routes/home/suspense";
import { fetchDashboard } from "@web/utils/api/routes/dashboard";
import type { DashboardSnapshotApi } from "@web/utils/api/routes/dashboard/types";
import { errorMessage } from "@web/utils/errors";
import { useCallback, useEffect, useRef, useState } from "react";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; snapshot: DashboardSnapshotApi };

export default function HomePage() {
  const { from, to, label, rangeLabel, unbounded } = useActivePeriod();
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
  const hasLoadedOnceRef = useRef(false);

  const load = useCallback(
    async (rangeFrom: string | undefined, rangeTo: string | undefined, background: boolean) => {
      if (!background) {
        setLoadState({ status: "loading" });
      }
      try {
        const response = await fetchDashboard(rangeFrom, rangeTo);
        hasLoadedOnceRef.current = true;
        setLoadState({ status: "success", snapshot: response });
      } catch (err: unknown) {
        if (background) {
          return;
        }
        setLoadState({
          status: "error",
          message: errorMessage(err, "Could not load dashboard"),
        });
      }
    },
    []
  );

  useEffect(() => {
    void load(unbounded ? undefined : from, unbounded ? undefined : to, hasLoadedOnceRef.current);
  }, [from, to, unbounded, load]);

  return (
    <div className="mx-auto w-full max-w-6xl">
      <PageTitle page="Dashboard" />
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">
          {unbounded || !rangeLabel ? label : `${label} · ${rangeLabel}`}
        </p>
      </header>

      {loadState.status === "loading" ? <DashboardPageSkeleton /> : null}

      {loadState.status === "error" ? (
        <div className="space-y-3">
          <p className="text-sm text-red-600">{loadState.message}</p>
          <SecondaryButton
            type="button"
            onClick={() =>
              void load(unbounded ? undefined : from, unbounded ? undefined : to, false)
            }
          >
            Retry
          </SecondaryButton>
        </div>
      ) : null}

      {loadState.status === "success" ? <Dashboard snapshot={loadState.snapshot} /> : null}
    </div>
  );
}
