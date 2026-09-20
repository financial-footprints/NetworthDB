import { ACCOUNTS_JSON_NAME } from "@core/domains/account/backup/constants";
import { z } from "zod";

export { ACCOUNTS_JSON_NAME };

export const backupAccountEntrySchema = z.object({
  id: z.string().uuid(),
  label: z.string(),
  account_type: z.string(),
  bank: z.string(),
  variant: z.string().nullable(),
  opening_date: z.string(),
  closing_date: z.string().nullable(),
  account_number: z.string(),
  has_passwords: z.boolean().optional(),
  has_mail_settings: z.boolean().optional(),
  has_statement_rules: z.boolean().optional(),
  passwords: z.array(z.string()).optional(),
  mail_rules: z.record(z.string(), z.unknown()).nullable().optional(),
  statement_rules: z.record(z.string(), z.unknown()).nullable().optional(),
});

export const backupAccountsFileSchema = z.array(backupAccountEntrySchema);
