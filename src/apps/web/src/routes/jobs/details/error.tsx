import { createResourceErrorFallback } from "@web/components/Error/fallback";
import { path } from "@web/router/routes";

export const JobDetailsErrorFallback = createResourceErrorFallback({
  notFoundTitle: "Job not found",
  notFoundMessage: "This job does not exist or is no longer available.",
  backTo: path.jobs.list,
  backLabel: "Back",
  errorTitle: "Could not load job",
});
