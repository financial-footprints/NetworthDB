import { jsonMedia } from "@api/config/http";
import { createSessionRouter, errorResponses } from "@api/config/router";
import { serializeJobsCancel } from "@api/routes/jobs/serializer";
import { sessionPrincipal } from "@ndb/middleware";
import { API, jobsCancelQuerySchema, jobsCancelSchema } from "@ndb/platform";

const cancelRoutes = createSessionRouter().endpoint(
  {
    method: "post",
    path: API.jobs.cancel,
    request: { query: jobsCancelQuerySchema },
    responses: {
      200: { content: jsonMedia(jobsCancelSchema), description: "Cancel jobs" },
      401: errorResponses[401],
      404: errorResponses[404],
    },
  },
  async (c) => {
    const query = c.req.valid("query");
    const { user, auth } = sessionPrincipal(c.get("principal"));
    const result = await c.get("services").jobService.cancel(user, auth.acr, query.jobId);
    return c.json(serializeJobsCancel(result.cancelledIds), 200);
  }
);

export default cancelRoutes;
