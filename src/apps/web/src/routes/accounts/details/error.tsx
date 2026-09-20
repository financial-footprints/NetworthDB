import { createResourceErrorFallback } from "@web/components/Error/fallback";
import { path } from "@web/router/routes";

export const DetailsErrorFallback = createResourceErrorFallback({
  notFoundTitle: "Account not found",
  notFoundMessage: "This account is not in your configuration or the URL is invalid.",
  backTo: path.accounts.list,
  backLabel: "Back",
  errorTitle: "Could not load account",
});
