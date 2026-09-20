import { StageError } from "@statements/engine/errors";

export function normalizeBankKey(bank: string): string {
  return bank.trim().toLowerCase();
}

export function normalizeVariantSegment(variant?: string | null): string | null {
  if (variant == null) {
    return null;
  }
  const cleaned = variant.trim().toLowerCase();
  if (cleaned.length === 0 || cleaned === "default") {
    return null;
  }
  return cleaned;
}

export function handlerRegistryKey(bank: string, variant?: string | null): string {
  const bankKey = normalizeBankKey(bank);
  const variantKey = normalizeVariantSegment(variant);
  if (variantKey == null) {
    return `${bankKey}/default`;
  }
  return `${bankKey}/${variantKey}`;
}

export class Registry<T> {
  private readonly items = new Map<string, T>();
  private readonly defaultValue?: T;
  private readonly keyFn: (bank: string, variant?: string | null) => string;

  constructor(
    options: {
      keyFn?: (bank: string, variant?: string | null) => string;
      defaultValue?: T;
    } = {}
  ) {
    this.keyFn = options.keyFn ?? handlerRegistryKey;
    this.defaultValue = options.defaultValue;
  }

  register(bank: string, variant: string | null | undefined, value: T): void {
    const key = this.keyFn(bank, variant ?? null);
    this.items.set(key, value);
  }

  get(bank: string, variant?: string | null): T {
    const bankKey = normalizeBankKey(bank);
    const variantKey = normalizeVariantSegment(variant);

    if (variantKey != null) {
      const exactKey = this.keyFn(bankKey, variantKey);
      const exact = this.items.get(exactKey);
      if (exact != null) {
        return exact;
      }
    }

    const fallbackKey = this.keyFn(bankKey, null);
    const fallback = this.items.get(fallbackKey);
    if (fallback != null) {
      return fallback;
    }

    if (this.defaultValue != null) {
      return this.defaultValue;
    }

    const known =
      this.items.size === 0 ? "(none registered)" : [...this.items.keys()].sort().join(", ");
    const variantMsg =
      variant != null && variant.length > 0 ? ` variant ${JSON.stringify(variant)}` : "";
    throw new StageError(
      `no registry entry for ${JSON.stringify(bankKey)}${variantMsg} (known: ${known})`
    );
  }

  keys(): string[] {
    return [...this.items.keys()].sort();
  }
}
