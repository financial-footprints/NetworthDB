export type CreditCardTitleLookup = {
  title(bank: string, variant: string | null | undefined): Promise<string | null>;
};
