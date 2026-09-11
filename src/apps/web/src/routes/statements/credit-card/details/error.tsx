import { createResourceErrorFallback } from "@web/components/error/ResourceErrorFallbackFactory";
import { path } from "@web/router/routes";

export const DetailsErrorFallback = createResourceErrorFallback({
  notFoundTitle: "Credit card not found",
  notFoundMessage: "This card is not in your configuration or the URL is invalid.",
  backTo: path.statements.credit_card.list,
  backLabel: "Back",
  errorTitle: "Could not load credit card",
});
