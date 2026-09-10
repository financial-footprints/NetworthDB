/** @type {import('dependency-cruiser').IConfiguration} */
export default {
  forbidden: [
    {
      name: "core-no-infrastructure",
      severity: "error",
      comment: "src/packages/core must stay domain-only (no database, logger, hono, or apps)",
      from: { path: "^src/packages/core" },
      to: {
        path: ["^src/packages/database", "^src/packages/logger", "^src/apps/", "node_modules/hono"],
      },
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
      name: "platform-no-infrastructure",
      severity: "error",
      comment:
        "src/packages/platform must stay transport-agnostic (no bootstrap, logger addon, Hono, or apps)",
      from: { path: "^src/packages/platform" },
      to: {
        path: [
          "^src/packages/bootstrap",
          "^src/packages/logger/(index\\.(js|d\\.ts)|.*\\.node$)",
          "^src/apps/",
          "node_modules/hono",
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
