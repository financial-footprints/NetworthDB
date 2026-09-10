import type { AuthEnv } from "@api/config/hono-env";
import { ApiRouter } from "@api/config/router";
import accountRoutes from "@api/routes/users/account";
import adminRoutes from "@api/routes/users/admin";
import meRoutes from "@api/routes/users/me";
import multifactorRoutes from "@api/routes/users/multifactor";
import vaultRoutes from "@api/routes/users/vault";

const userRoutes = new ApiRouter<AuthEnv>()
  .route("/", meRoutes)
  .route("/", accountRoutes)
  .route("/", vaultRoutes)
  .route("/", multifactorRoutes)
  .route("/", adminRoutes);

export default userRoutes;
