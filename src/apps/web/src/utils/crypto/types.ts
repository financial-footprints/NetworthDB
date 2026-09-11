import { isTotpEnrolled } from "@web/context/Auth/session";

export type EncryptionFieldKind = "e2ee" | "server_plain" | "server_hashed" | "server_encrypted";

export type EncryptionFieldDefinition = {
  label: string;
  kind: EncryptionFieldKind;
  detail?: string;
  showCondition?: () => boolean;
};

type EncryptionModuleDefinition = {
  id: "profile" | "accounts" | "statements";
  name: string;
  isEnabled: () => boolean;
  fields: EncryptionFieldDefinition[];
};

export type VisibleEncryptionModule = {
  module: EncryptionModuleDefinition;
  fields: EncryptionFieldDefinition[];
};

const PROFILE_MODULE: EncryptionModuleDefinition = {
  id: "profile",
  name: "Profile",
  isEnabled: () => true,
  fields: [
    { label: "Your Name", kind: "e2ee" },
    { label: "Username", kind: "server_plain" },
    { label: "Recovery Email", kind: "server_hashed" },
    {
      label: "Authenticator Secret",
      kind: "server_encrypted",
      showCondition: () => isTotpEnrolled(),
      detail:
        "Stores the secret key for multi-factor authentication (MFA) apps like Google Authenticator.",
    },
  ],
};

const ACCOUNTS_MODULE: EncryptionModuleDefinition = {
  id: "accounts",
  name: "Accounts",
  isEnabled: () => true,
  fields: [
    {
      label: "Account Metadata",
      kind: "server_encrypted",
      detail:
        "Bank, variant, account type, opening and closing dates, and the display label shown on account tiles.",
    },
    { label: "Account Number", kind: "e2ee" },
    {
      label: "Account Secrets",
      kind: "server_encrypted",
      detail: "Statement file passwords, email matching rules, and statement cleanup rules.",
    },
  ],
};

const STATEMENTS_MODULE: EncryptionModuleDefinition = {
  id: "statements",
  name: "Statements",
  isEnabled: () => true,
  fields: [
    {
      label: "Statement Files",
      kind: "server_encrypted",
      detail: "PDF, CSV, and text statement files. Encrypted on the server at rest.",
    },
    {
      label: "Source Credentials",
      kind: "server_encrypted",
      detail:
        "Thunderbird profile paths and email (IMAP) credentials configured in Profile settings.",
    },
  ],
};

const ENCRYPTION_MODULES: EncryptionModuleDefinition[] = [
  PROFILE_MODULE,
  ACCOUNTS_MODULE,
  STATEMENTS_MODULE,
];

function getVisibleFields(module: EncryptionModuleDefinition): EncryptionFieldDefinition[] {
  return module.fields.filter((field) => field.showCondition?.() ?? true);
}

export function visibleEncryptionModules(): VisibleEncryptionModule[] {
  return ENCRYPTION_MODULES.filter((module) => module.isEnabled())
    .map((module) => ({
      module,
      fields: getVisibleFields(module),
    }))
    .filter(({ fields }) => fields.length > 0);
}
