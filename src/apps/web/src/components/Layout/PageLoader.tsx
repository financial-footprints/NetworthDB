import loadingIllustration from "@web/assets/images/illustrations/loading.svg";
import { StatusView } from "@web/components/Layout/StatusView";

export function PageLoader() {
  return (
    <StatusView
      illustration={loadingIllustration}
      title="Loading"
      message="Just a moment while we fetch your data…"
      variant="loading"
    />
  );
}
