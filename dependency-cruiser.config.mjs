/** @type {import('dependency-cruiser').IConfiguration} */
export default {
  forbidden: [
    {
      name: "core-no-infrastructure",
      severity: "error",
      comment: "src/packages/core must stay domain-only (no database, logger, hono, or apps)",
      from: { path: "^src/packages/core" },
      to: {
        path: [
          "^src/packages/auth",
          "^src/packages/database",
          "^src/packages/encryption",
          "^src/packages/logger",
          "^src/packages/statements",
          "^src/packages/platform",
          "^src/apps/",
          "node_modules/hono",
          "node_modules/redis",
          "node_modules/drizzle-orm",
          "node_modules/pg",
        ],
      },
    },
    {
      name: "core-no-auth",
      severity: "error",
      comment: "src/packages/core must not depend on src/packages/auth",
      from: { path: "^src/packages/core" },
      to: { path: "^src/packages/auth" },
    },
    {
      name: "core-no-platform",
      severity: "error",
      comment: "src/packages/core must not depend on src/packages/platform",
      from: { path: "^src/packages/core" },
      to: { path: "^src/packages/platform" },
    },
    {
      name: "database-no-apps",
      severity: "error",
      comment: "src/packages/database must not depend on apps",
      from: { path: "^src/packages/database" },
      to: { path: "^src/apps/" },
    },
    {
      name: "database-no-hono",
      severity: "error",
      comment: "src/packages/database must not depend on Hono",
      from: { path: "^src/packages/database" },
      to: { path: "node_modules/hono" },
    },
    {
      name: "middleware-no-database",
      severity: "error",
      comment: "src/packages/middleware must not depend on src/packages/database",
      from: { path: "^src/packages/middleware" },
      to: { path: "^src/packages/database" },
    },
    {
      name: "logger-no-database",
      severity: "error",
      comment: "src/packages/logger must not depend on src/packages/database",
      from: { path: "^src/packages/logger" },
      to: { path: "^src/packages/database" },
    },
    {
      name: "platform-no-infrastructure",
      severity: "error",
      comment:
        "src/packages/platform must stay transport-agnostic (no bootstrap, logger, Hono, or apps)",
      from: { path: "^src/packages/platform" },
      to: {
        path: [
          "^src/packages/bootstrap",
          "^src/apps/",
          "node_modules/hono",
          "node_modules/drizzle-orm",
          "node_modules/pg",
        ],
      },
    },
    {
      name: "web-no-database",
      severity: "error",
      comment: "src/apps/web must not depend on src/packages/database directly",
      from: { path: "^src/apps/web" },
      to: { path: "^src/packages/database" },
    },
    {
      name: "auth-no-apps",
      severity: "error",
      comment: "src/packages/auth must not depend on apps or database",
      from: { path: "^src/packages/auth" },
      to: {
        path: [
          "^src/packages/database",
          "^src/apps/",
          "node_modules/hono",
          "node_modules/drizzle-orm",
          "node_modules/pg",
        ],
      },
    },
    {
      name: "encryption-no-apps",
      severity: "error",
      comment: "src/packages/encryption must not depend on apps or database",
      from: { path: "^src/packages/encryption" },
      to: {
        path: [
          "^src/packages/database",
          "^src/apps/",
          "node_modules/hono",
          "node_modules/drizzle-orm",
          "node_modules/pg",
        ],
      },
    },
    {
      name: "notifications-no-apps",
      severity: "error",
      comment: "src/packages/notifications must not depend on apps or database",
      from: { path: "^src/packages/notifications" },
      to: {
        path: [
          "^src/packages/database",
          "^src/apps/",
          "node_modules/hono",
          "node_modules/drizzle-orm",
          "node_modules/pg",
        ],
      },
    },
    {
      name: "statements-no-apps",
      severity: "error",
      comment: "src/packages/statements must not depend on apps or database",
      from: { path: "^src/packages/statements" },
      to: {
        path: [
          "^src/packages/database",
          "^src/apps/",
          "node_modules/hono",
          "node_modules/drizzle-orm",
          "node_modules/pg",
        ],
      },
    },
    {
      name: "bootstrap-no-apps",
      severity: "error",
      comment: "src/packages/bootstrap must not depend on apps",
      from: { path: "^src/packages/bootstrap" },
      to: { path: "^src/apps/" },
    },
    {
      name: "bootstrap-no-hono",
      severity: "error",
      comment: "src/packages/bootstrap must not depend on Hono",
      from: { path: "^src/packages/bootstrap" },
      to: { path: "node_modules/hono" },
    },
    {
      name: "mcp-no-bootstrap",
      severity: "error",
      comment: "src/packages/mcp must not depend on src/packages/bootstrap",
      from: { path: "^src/packages/mcp" },
      to: { path: "^src/packages/bootstrap" },
    },
    {
      name: "mcp-no-apps",
      severity: "error",
      comment: "src/packages/mcp must not depend on apps or hono",
      from: { path: "^src/packages/mcp" },
      to: {
        path: ["^src/apps/", "node_modules/hono"],
      },
    },
    {
      name: "copilot-no-bootstrap",
      severity: "error",
      comment: "src/apps/copilot must not depend on src/packages/bootstrap",
      from: { path: "^src/apps/copilot" },
      to: { path: "^src/packages/bootstrap" },
    },
    {
      name: "apps-no-drizzle-repositories",
      severity: "error",
      comment: "apps must use domain services, not Drizzle repository implementations",
      from: { path: "^src/apps/(api|copilot)" },
      to: { path: "^src/packages/database/src/repositories" },
    },
  ],
  options: {
    exclude: {
      path: "/dist/",
    },
    doNotFollow: {
      path: "node_modules",
    },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default"],
    },
  },
};
