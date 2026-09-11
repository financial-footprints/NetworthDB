import defaultErrorIllustration from "@web/assets/images/illustrations/warning.svg";
import { PrimaryButton, SecondaryButton } from "@web/components/button";
import { StatusView } from "@web/components/layout/StatusView";
import type { ReactNode } from "react";
import { FaHome, FaRedo } from "react-icons/fa";

type ErrorViewContentProps = {
  title?: string;
  message: string;
  illustration?: string;
  onRetry?: () => void;
  fullPage?: boolean;
};

export function ErrorViewContent({
  title = "Something went wrong",
  message,
  illustration = defaultErrorIllustration,
  onRetry,
  fullPage = false,
}: ErrorViewContentProps): ReactNode {
  return (
    <StatusView
      illustration={illustration}
      title={title}
      message={message}
      fullPage={fullPage}
      actions={
        <>
          {onRetry && (
            <SecondaryButton onClick={onRetry}>
              <FaRedo aria-hidden />
              Try again
            </SecondaryButton>
          )}
          <PrimaryButton to="/">
            <FaHome aria-hidden />
            Go home
          </PrimaryButton>
        </>
      }
    />
  );
}
