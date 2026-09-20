export const CATALOG_GROUPS = [
  {
    kind: "group",
    id: "fees",
    label: "Fees",
    fields: [
      { id: "joining", label: "Joining fee" },
      { id: "annual", label: "Annual fee" },
      { id: "annual_waiver", label: "Annual fee waiver" },
      { id: "forex", label: "Forex markup" },
      { id: "fuel_surcharge", label: "Fuel surcharge" },
    ],
  },
  {
    kind: "group",
    id: "rewards",
    label: "Rewards",
    fields: [
      { id: "base_earn", label: "Base earn" },
      { id: "accelerated", label: "Accelerated earn" },
      { id: "upi", label: "UPI" },
      { id: "redemption", label: "Redemption" },
      { id: "expiry", label: "Point expiry" },
    ],
  },
  {
    kind: "group",
    id: "lounge",
    label: "Lounge",
    fields: [
      { id: "summary", label: "Overview" },
      { id: "domestic", label: "Domestic airport" },
      { id: "international", label: "International airport" },
      { id: "railway", label: "Railway" },
    ],
  },
  {
    kind: "group",
    id: "lifestyle",
    label: "Lifestyle",
    fields: [
      { id: "dining", label: "Dining" },
      { id: "movies", label: "Movies" },
      { id: "golf", label: "Golf" },
      { id: "concierge", label: "Concierge" },
    ],
  },
  {
    kind: "group",
    id: "insurance",
    label: "Insurance",
    fields: [
      { id: "travel", label: "Travel insurance" },
      { id: "accident", label: "Accident cover" },
      { id: "card_protect", label: "Card protection" },
    ],
  },
  { kind: "slot", id: "milestones", label: "Milestones" },
  { kind: "slot", id: "welcome", label: "Welcome benefits" },
] as const;

export type CatalogGroup = (typeof CATALOG_GROUPS)[number];
export type CatalogGroupId = CatalogGroup["id"];
