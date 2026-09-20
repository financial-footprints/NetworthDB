export const API_PREFIX = "/api/v1";

export const API = {
  health: { get: "/health" },
  config: { get: `${API_PREFIX}/config` },
  auth: {
    session: {
      login: `${API_PREFIX}/auth/login`,
      logout: `${API_PREFIX}/auth/logout`,
      refresh: `${API_PREFIX}/auth/refresh`,
      multifactor: {
        otp: `${API_PREFIX}/auth/multifactor/verify`,
        webauthn: {
          begin: `${API_PREFIX}/auth/multifactor/webauthn/login/begin`,
          finish: `${API_PREFIX}/auth/multifactor/webauthn/login/finish`,
        },
      },
    },
    recovery: {
      password: {
        begin: `${API_PREFIX}/auth/recovery/password/begin`,
        complete: `${API_PREFIX}/auth/recovery/password/complete`,
        webauthn: `${API_PREFIX}/auth/recovery/password/webauthn/begin`,
      },
      advanced: {
        begin: `${API_PREFIX}/auth/recovery/advanced/begin`,
        context: `${API_PREFIX}/auth/recovery/advanced/context`,
        webauthn: `${API_PREFIX}/auth/recovery/advanced/webauthn/begin`,
        complete: `${API_PREFIX}/auth/recovery/advanced/complete`,
      },
    },
  },
  accounts: {
    list: `${API_PREFIX}/accounts`,
    create: `${API_PREFIX}/accounts`,
    banks: { get: `${API_PREFIX}/accounts/banks` },
    system: { get: `${API_PREFIX}/accounts/system` },
    get: `${API_PREFIX}/accounts/{accountId}`,
    patch: `${API_PREFIX}/accounts/{accountId}`,
    delete: `${API_PREFIX}/accounts/{accountId}`,
    metadata: { get: `${API_PREFIX}/accounts/{accountId}/metadata` },
    files: {
      upload: `${API_PREFIX}/accounts/files/upload`,
      download: `${API_PREFIX}/accounts/{accountId}/files`,
    },
    statements: {
      sync: `${API_PREFIX}/accounts/statements/sync`,
      transactionsSync: `${API_PREFIX}/accounts/{accountId}/statements/transactions-sync`,
    },
    transactions: {
      list: `${API_PREFIX}/accounts/{accountId}/transactions`,
      create: `${API_PREFIX}/accounts/{accountId}/transactions`,
      batch: `${API_PREFIX}/accounts/{accountId}/transactions/batch`,
      bulk: `${API_PREFIX}/accounts/{accountId}/transactions/bulk`,
      bulkDelete: `${API_PREFIX}/accounts/{accountId}/transactions/bulk-delete`,
      summary: `${API_PREFIX}/accounts/{accountId}/transactions/summary`,
      balance: `${API_PREFIX}/accounts/{accountId}/transactions/balance`,
      patch: `${API_PREFIX}/accounts/{accountId}/transactions/{transactionId}`,
      delete: `${API_PREFIX}/accounts/{accountId}/transactions/{transactionId}`,
    },
    transactionImports: {
      create: `${API_PREFIX}/accounts/{accountId}/transaction-imports`,
      delete: `${API_PREFIX}/accounts/{accountId}/transaction-imports/{importId}`,
    },
  },
  jobs: {
    list: `${API_PREFIX}/jobs`,
    get: `${API_PREFIX}/jobs/{jobId}`,
    cancel: `${API_PREFIX}/jobs/cancel`,
  },
  sources: {
    get: `${API_PREFIX}/sources`,
    put: `${API_PREFIX}/sources`,
  },
  categories: {
    list: `${API_PREFIX}/categories`,
    create: `${API_PREFIX}/categories`,
    patch: `${API_PREFIX}/categories/{categoryId}`,
    delete: `${API_PREFIX}/categories/{categoryId}`,
  },
  tags: {
    list: `${API_PREFIX}/tags`,
    create: `${API_PREFIX}/tags`,
    patch: `${API_PREFIX}/tags/{tagId}`,
    delete: `${API_PREFIX}/tags/{tagId}`,
  },
  ruleGroups: {
    list: `${API_PREFIX}/rule-groups`,
    create: `${API_PREFIX}/rule-groups`,
    get: `${API_PREFIX}/rule-groups/{ruleGroupId}`,
    patch: `${API_PREFIX}/rule-groups/{ruleGroupId}`,
    delete: `${API_PREFIX}/rule-groups/{ruleGroupId}`,
    apply: `${API_PREFIX}/rule-groups/{ruleGroupId}/apply`,
  },
  rules: {
    list: `${API_PREFIX}/rules`,
    create: `${API_PREFIX}/rules`,
    get: `${API_PREFIX}/rules/{ruleId}`,
    patch: `${API_PREFIX}/rules/{ruleId}`,
    delete: `${API_PREFIX}/rules/{ruleId}`,
    apply: `${API_PREFIX}/rules/{ruleId}/apply`,
    test: `${API_PREFIX}/rules/{ruleId}/test`,
  },
  dashboard: { get: `${API_PREFIX}/dashboard` },
  creditCards: {
    catalog: {
      list: `${API_PREFIX}/credit-cards/catalog`,
      bulk: `${API_PREFIX}/credit-cards/catalog/bulk`,
      get: `${API_PREFIX}/credit-cards/catalog/{bank}/{variant}`,
    },
    benefits: {
      get: `${API_PREFIX}/credit-cards/benefits/{slotId}`,
    },
  },
  backup: {
    get: `${API_PREFIX}/backup`,
    export: `${API_PREFIX}/backup/export`,
    import: `${API_PREFIX}/backup/import`,
    file: `${API_PREFIX}/backup/file`,
  },
  users: {
    create: `${API_PREFIX}/users`,
    list: `${API_PREFIX}/users`,
    patch: `${API_PREFIX}/users/{userId}`,
    delete: `${API_PREFIX}/users/{userId}`,
    me: {
      get: `${API_PREFIX}/users/me`,
      patch: `${API_PREFIX}/users/me`,
      totp: {
        begin: `${API_PREFIX}/users/me/totp/begin`,
        confirm: `${API_PREFIX}/users/me/totp/confirm`,
        disable: `${API_PREFIX}/users/me/totp`,
      },
      webauthn: {
        create: {
          begin: `${API_PREFIX}/users/me/webauthn/register/begin`,
          finish: `${API_PREFIX}/users/me/webauthn/register/finish`,
        },
        list: `${API_PREFIX}/users/me/webauthn/credentials`,
        delete: `${API_PREFIX}/users/me/webauthn/credentials/{credentialId}`,
      },
      vault: {
        initialize: `${API_PREFIX}/users/me/vault/initialize`,
        slots: {
          create: `${API_PREFIX}/users/me/vault/slots`,
          patch: `${API_PREFIX}/users/me/vault/slots/{slotId}`,
          delete: `${API_PREFIX}/users/me/vault/slots/{slotId}`,
        },
      },
      codes: `${API_PREFIX}/users/me/codes`,
    },
  },
} as const;

export const PUBLIC_API_PATHS = [
  API.health.get,
  API.config.get,
  API.auth.session.login,
  API.auth.session.refresh,
  API.auth.session.multifactor.otp,
  API.auth.session.multifactor.webauthn.begin,
  API.auth.session.multifactor.webauthn.finish,
  API.auth.recovery.password.begin,
  API.auth.recovery.password.complete,
  API.auth.recovery.password.webauthn,
  API.auth.recovery.advanced.begin,
  API.auth.recovery.advanced.context,
  API.auth.recovery.advanced.webauthn,
  API.auth.recovery.advanced.complete,
  "/doc",
  "/doc/ui",
] as const;

export function apiPath(template: string, params?: Record<string, string>): string {
  let path = template;
  for (const [key, value] of Object.entries(params ?? {})) {
    path = path.split(`{${key}}`).join(encodeURIComponent(value));
  }
  return path;
}
