import type { SlotConfidence } from "@ndb/platform";

export function confidenceLabel(confidence: SlotConfidence): string {
  switch (confidence) {
    case "verified_mitc":
      return "Verified from MITC";
    case "verified_product_page":
      return "Verified from product page";
    case "conflict":
      return "Conflict in sources";
    case "unknown":
      return "Source confidence unknown";
    default:
      return confidence;
  }
}
