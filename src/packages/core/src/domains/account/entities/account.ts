import type { AccountType } from "@core/domains/account/constants";
import { parseIsoDate } from "@core/shared/date";
import { ValidationError } from "@core/shared/errors/domain-error";

const MAX_ACCOUNT_NUMBER_LEN = 2100;

export type MailRules = {
  subjects: string[];
  bodyContains: string[];
  fromAddresses: string[];
};

export type StatementRules = {
  textContains: string[];
  textNotContains: string[];
};

export class Account {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly accountType: AccountType,
    public readonly bank: string,
    public readonly variant: string | null,
    public readonly label: string,
    public readonly openingDate: string,
    public readonly closingDate: string | null,
    public readonly accountNumber: string,
    public readonly passwords: string[],
    public readonly mail: MailRules | null,
    public readonly statement: StatementRules | null,
    public readonly createdAt: string,
    public readonly updatedAt: string
  ) {}

  static readonly normalize = {
    variant(variant: string | null | undefined): string | null {
      if (variant === undefined || variant === null) {
        return null;
      }

      const trimmed = variant.trim();
      if (!trimmed || trimmed === "default") {
        return null;
      }

      return trimmed;
    },

    bank(bank: string): string {
      const trimmed = bank.trim();
      if (!trimmed) {
        throw new ValidationError("core.account.bank.invalid.required", { field: "bank" });
      }

      return trimmed;
    },

    accountNumber(value: string): string {
      const trimmed = value.trim();
      if (trimmed.length === 0) {
        throw new ValidationError("core.account.account-number.invalid.required", {
          field: "account_number",
        });
      }

      if (trimmed.length > MAX_ACCOUNT_NUMBER_LEN) {
        throw new ValidationError("core.account.account-number.invalid.too-long", {
          field: "account_number",
        });
      }

      return trimmed;
    },
  };

  static generateLabel(bank: string, variant: string | null | undefined): string {
    const normalizedVariant = Account.normalize.variant(variant);
    if (!normalizedVariant) {
      return bank;
    }

    return `${bank} (${normalizedVariant})`;
  }

  static create(props: {
    id?: string;
    userId: string;
    accountType: AccountType;
    bank: string;
    variant?: string | null;
    openingDate: string;
    closingDate?: string | null;
    accountNumber: string;
    passwords: string[];
    mail?: MailRules | null;
    statement?: StatementRules | null;
    createdAt?: string;
    updatedAt?: string;
  }): Account {
    const bank = Account.normalize.bank(props.bank);
    const variant = Account.normalize.variant(props.variant);
    const openingDate = parseIsoDate(props.openingDate, "opening_date");
    const closingDate =
      props.closingDate === undefined || props.closingDate === null
        ? null
        : parseIsoDate(props.closingDate, "closing_date");
    Account.validateClosingDate(openingDate, closingDate);

    const accountNumber = Account.normalize.accountNumber(props.accountNumber);
    const now = props.createdAt ?? new Date().toISOString();

    return new Account(
      props.id ?? crypto.randomUUID(),
      props.userId,
      props.accountType,
      bank,
      variant,
      Account.generateLabel(bank, variant),
      openingDate,
      closingDate,
      accountNumber,
      [...props.passwords],
      Account.cloneMailRules(props.mail ?? null),
      Account.cloneStatementRules(props.statement ?? null),
      now,
      props.updatedAt ?? now
    );
  }

  withUpdates(input: {
    accountType?: AccountType;
    bank?: string;
    variant?: string | null;
    openingDate?: string;
    closingDate?: string | null;
    accountNumber?: string;
    passwords?: string[];
    mail?: MailRules | null;
    statement?: StatementRules | null;
    updatedAt: string;
  }): Account {
    const bank = input.bank !== undefined ? Account.normalize.bank(input.bank) : this.bank;
    const variant =
      input.variant !== undefined ? Account.normalize.variant(input.variant) : this.variant;
    const openingDate =
      input.openingDate !== undefined
        ? parseIsoDate(input.openingDate, "opening_date")
        : this.openingDate;
    const closingDate =
      input.closingDate !== undefined
        ? input.closingDate === null
          ? null
          : parseIsoDate(input.closingDate, "closing_date")
        : this.closingDate;
    Account.validateClosingDate(openingDate, closingDate);

    const accountNumber =
      input.accountNumber !== undefined
        ? Account.normalize.accountNumber(input.accountNumber)
        : this.accountNumber;

    return new Account(
      this.id,
      this.userId,
      input.accountType ?? this.accountType,
      bank,
      variant,
      Account.generateLabel(bank, variant),
      openingDate,
      closingDate,
      accountNumber,
      input.passwords !== undefined ? [...input.passwords] : [...this.passwords],
      input.mail !== undefined
        ? Account.cloneMailRules(input.mail)
        : Account.cloneMailRules(this.mail),
      input.statement !== undefined
        ? Account.cloneStatementRules(input.statement)
        : Account.cloneStatementRules(this.statement),
      this.createdAt,
      input.updatedAt
    );
  }

  hasPasswords(): boolean {
    return this.passwords.length > 0;
  }

  hasMailSettings(): boolean {
    const mail = this.mail;
    return (
      mail !== null &&
      (mail.subjects.length > 0 || mail.bodyContains.length > 0 || mail.fromAddresses.length > 0)
    );
  }

  hasStatementRules(): boolean {
    const rules = this.statement;
    return rules !== null && (rules.textContains.length > 0 || rules.textNotContains.length > 0);
  }

  private static validateClosingDate(
    openingDate: string,
    closingDate: string | null | undefined
  ): void {
    if (closingDate !== undefined && closingDate !== null && closingDate < openingDate) {
      throw new ValidationError("core.account.date.invalid.closing-before-opening", {
        field: "closing_date",
      });
    }
  }

  private static cloneMailRules(mail: MailRules | null): MailRules | null {
    if (mail === null) {
      return null;
    }

    return {
      subjects: [...mail.subjects],
      bodyContains: [...mail.bodyContains],
      fromAddresses: [...mail.fromAddresses],
    };
  }

  private static cloneStatementRules(rules: StatementRules | null): StatementRules | null {
    if (rules === null) {
      return null;
    }

    return {
      textContains: [...rules.textContains],
      textNotContains: [...rules.textNotContains],
    };
  }
}
