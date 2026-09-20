export const path = {
  home: "/",
  login: "/login",
  notFound: "*",
  recovery: {
    request: "/recovery/request",
    password: "/recovery/password",
    advanced: "/recovery/advanced",
  },
  jobs: {
    list: "/jobs",
    details: (jobId = ":jobId") => `/jobs/${jobId}`,
  },
  categories: {
    list: "/categories",
  },
  tags: {
    list: "/tags",
  },
  rules: {
    list: "/rules",
    create: "/rules/new",
    details: (ruleId = ":ruleId") => `/rules/${ruleId}`,
  },
  accounts: {
    list: "/accounts",
    details: (accountId = ":accountId") => `/accounts/${accountId}`,
    statements: (accountId = ":accountId") => `/accounts/${accountId}/statements`,
  },
  creditCards: {
    hub: "/credit-cards",
  },
} as const;
