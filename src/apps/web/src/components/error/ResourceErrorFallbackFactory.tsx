import connectionLostIllustration from "@web/assets/images/illustrations/connection-lost.svg";
import notFoundIllustration from "@web/assets/images/illustrations/page-not-found.svg";
import {
  ResourceErrorFallback,
  ResourceNotFoundFallback,
} from "@web/components/error/ResourceErrorFallback";
import { ApiError } from "@web/utils/api/types";
import type { ReactNode } from "react";

type CreateResourceErrorFallbackOptions = {
  notFoundTitle: string;
  notFoundMessage: string;
  backTo: string;
  backLabel: string;
  errorTitle: string;
};

type ResourceErrorFallbackProps = {
  error: Error;
  reset: () => void;
  onRetry?: () => void;
};

export function createResourceErrorFallback({
  notFoundTitle,
  notFoundMessage,
  backTo,
  backLabel,
  errorTitle,
}: CreateResourceErrorFallbackOptions) {
  return function ResourceDetailsErrorFallback({
    error,
    reset,
    onRetry,
  }: ResourceErrorFallbackProps): ReactNode {
    if (error instanceof ApiError && error.status === 404) {
      return (
        <ResourceNotFoundFallback
          illustration={notFoundIllustration}
          title={notFoundTitle}
          message={notFoundMessage}
          backTo={backTo}
          backLabel={backLabel}
        />
      );
    }

    return (
      <ResourceErrorFallback
        title={errorTitle}
        message={error.message || "An unexpected error occurred."}
        illustration={connectionLostIllustration}
        onRetry={() => {
          onRetry?.();
          reset();
        }}
      />
    );
  };
}
