import connectionLostIllustration from "@web/assets/images/illustrations/connection-lost.svg";
import { ErrorBoundary } from "@web/components/Error/ErrorBoundary";
import { View } from "@web/components/Error/View";
import { PageLoader } from "@web/components/Layout/PageLoader";
import { type ReactNode, Suspense } from "react";

type PageBoundaryProps = {
  errorTitle: string;
  onRetry: () => void;
  loadingFallback?: ReactNode;
  errorFallback?: (props: { error: Error; reset: () => void }) => ReactNode;
  children: ReactNode;
};

export function PageBoundary({
  errorTitle,
  onRetry,
  loadingFallback,
  errorFallback,
  children,
}: PageBoundaryProps) {
  return (
    <ErrorBoundary
      fallback={
        errorFallback ??
        (({ error, reset }) => (
          <View
            title={errorTitle}
            message={error.message || "An unexpected error occurred."}
            illustration={connectionLostIllustration}
            onRetry={() => {
              onRetry();
              reset();
            }}
          />
        ))
      }
    >
      <Suspense fallback={loadingFallback ?? <PageLoader />}>{children}</Suspense>
    </ErrorBoundary>
  );
}
