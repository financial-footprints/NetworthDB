import { JOB_STAGES, JOB_STATUSES } from "@ndb/core";

export const DOCS_JOBS_MARKDOWN = `# Background jobs

Job rows (\`jobs\` table) track async work. Metadata is queryable; encrypted output/logs blobs are not exposed to MCP SQL.

## Stages

${JOB_STAGES.map((stage) => `- \`${stage}\``).join("\n")}

## Statuses

${JOB_STATUSES.map((status) => `- \`${status}\``).join("\n")}

Enqueue endpoints return **202** with \`{ jobId }\`. Poll \`GET /api/v1/jobs/{jobId}\` until \`completed\`, \`failed\`, or \`cancelled\`. Active statuses: \`queued\`, \`running\`.
`;
