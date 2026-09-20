import notFoundIllustration from "@web/assets/images/illustrations/page-not-found.svg";
import { PrimaryButton } from "@web/components/Button";
import { StatusView } from "@web/components/Layout/StatusView";
import { FaHome } from "react-icons/fa";

export function NotFound() {
  return (
    <StatusView
      illustration={notFoundIllustration}
      code="404"
      title="Page Not Found"
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
