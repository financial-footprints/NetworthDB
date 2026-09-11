import notFoundIllustration from "@web/assets/images/illustrations/page-not-found.svg";
import { PrimaryButton } from "@web/components/button";
import { StatusView } from "@web/components/layout/StatusView";
import { FaHome } from "react-icons/fa";

export function NotFoundView() {
  return (
    <StatusView
      illustration={notFoundIllustration}
      code="404"
      title="Page not found"
      message="The page you're looking for doesn't exist or was moved."
      actions={
        <PrimaryButton to="/">
          <FaHome aria-hidden />
          Go home
        </PrimaryButton>
      }
    />
  );
}
