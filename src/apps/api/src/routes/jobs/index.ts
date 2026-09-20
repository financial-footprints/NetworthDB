import type { AuthEnv } from "@api/config/hono-env";
import { jsonMedia } from "@api/config/http";
import { ApiRouter, createSessionRouter, errorResponses } from "@api/config/router";
import cancelRoutes from "@api/routes/jobs/cancel";
import { serializeJob, serializeJobList } from "@api/routes/jobs/serializer";
import { sessionPrincipal } from "@ndb/middleware";
import { API, jobIdParamsSchema, jobListSchema, jobSchema } from "@ndb/platform";

const jobListRoutes = createSessionRouter()
  .endpoint(
    {
      method: "get",
      path: API.jobs.list,
      responses: {
        200: { content: jsonMedia(jobListSchema), description: "Job list" },
        401: errorResponses[401],
      },
    },
    async (c) => {
      const { user, auth } = sessionPrincipal(c.get("principal"));
      const result = await c.get("services").jobService.list(user, auth.acr);
      return c.json(serializeJobList(result.items, result.total), 200);
    }
  )
  .endpoint(
    {
      method: "get",
      path: API.jobs.get,
      request: { params: jobIdParamsSchema },
      responses: {
        200: { content: jsonMedia(jobSchema), description: "Job details" },
        401: errorResponses[401],
        404: errorResponses[404],
      },
    },
    async (c) => {
      const { jobId } = c.req.valid("param");
      const { user, auth } = sessionPrincipal(c.get("principal"));
      const job = await c.get("services").jobService.get(user, auth.acr, jobId);
      return c.json(serializeJob(job), 200);
    }
  );

const jobRoutes = new ApiRouter<AuthEnv>().route("/", cancelRoutes).route("/", jobListRoutes);

export default jobRoutes;
