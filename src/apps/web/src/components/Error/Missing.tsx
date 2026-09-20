import { PrimaryButton } from "@web/components/Button";
import { StatusView } from "@web/components/Layout/StatusView";
import type { ReactNode } from "react";
import { FaArrowLeft } from "react-icons/fa";

type ResourceNotFoundFallbackProps = {
  illustration: string;
  title: string;
  message: string;
  backTo: string;
  backLabel: string;
};

export function Missing({
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
