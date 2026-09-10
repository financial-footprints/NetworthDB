import type { AuthEnv } from "@api/config/hono-env";
import { ApiRouter } from "@api/config/router";
import { mfaChallengeRoutes, mfaLoginBeginRoutes } from "@api/routes/auth/multifactor";
import rateLimitedRoutes from "@api/routes/auth/ratelimit";

const authRoutes = new ApiRouter<AuthEnv>()
  .route("/", rateLimitedRoutes)
  .route("/", mfaChallengeRoutes)
  .route("/", mfaLoginBeginRoutes);

export default authRoutes;
