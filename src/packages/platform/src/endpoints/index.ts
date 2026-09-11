export const API_PREFIX = "/api/v1";

export const API = {
  health: {
    get: "/health",
  },
  config: {
    get: `${API_PREFIX}/config`,
  },
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
    banks: `${API_PREFIX}/accounts/banks`,
    details: `${API_PREFIX}/accounts/:id`,
    metadata: `${API_PREFIX}/accounts/:id/metadata`,
    files: {
      upload: `${API_PREFIX}/accounts/files/upload`,
      download: `${API_PREFIX}/accounts/:id/files`,
    },
    statements: {
      sync: `${API_PREFIX}/accounts/statements/sync`,
    },
  },
  jobs: {
    list: `${API_PREFIX}/jobs`,
    details: `${API_PREFIX}/jobs/:id`,
    cancel: `${API_PREFIX}/jobs/cancel`,
  },
  sources: `${API_PREFIX}/sources`,
  users: {
    create: `${API_PREFIX}/users`,
    list: `${API_PREFIX}/users`,
    details: `${API_PREFIX}/users/:id`,
    me: {
      details: `${API_PREFIX}/users/me`,
      update: `${API_PREFIX}/users/me`,
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
        details: `${API_PREFIX}/users/me/webauthn/credentials/:id`,
      },
      vault: {
        initialize: `${API_PREFIX}/users/me/vault/initialize`,
        slots: {
          list: `${API_PREFIX}/users/me/vault/slots`,
          details: `${API_PREFIX}/users/me/vault/slots/:id`,
        },
      },
      codes: `${API_PREFIX}/users/me/codes`,
    },
  },
} as const;
