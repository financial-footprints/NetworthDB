import { PrimaryButton } from "@web/components/button";
import { ErrorViewContent } from "@web/components/error/ErrorViewContent";
import { StatusView } from "@web/components/layout/StatusView";
import type { ReactNode } from "react";
import { FaArrowLeft } from "react-icons/fa";

type ResourceNotFoundFallbackProps = {
  illustration: string;
  title: string;
  message: string;
  backTo: string;
  backLabel: string;
};

export function ResourceNotFoundFallback({
  illustration,
  title,
  message,
  backTo,
  backLabel,
}: ResourceNotFoundFallbackProps): ReactNode {
  return (
    <StatusView
      illustration={illustration}
      code="404"
      title={title}
      message={message}
      actions={
        <PrimaryButton to={backTo}>
          <FaArrowLeft aria-hidden />
          {backLabel}
        </PrimaryButton>
      }
    />
  );
}

type ResourceErrorFallbackProps = {
  title: string;
  message: string;
  illustration: string;
  onRetry: () => void;
};

export function ResourceErrorFallback({
  title,
  message,
  illustration,
  onRetry,
}: ResourceErrorFallbackProps): ReactNode {
  return (
    <ErrorViewContent
      title={title}
      message={message}
      illustration={illustration}
      onRetry={onRetry}
    />
  );
}
