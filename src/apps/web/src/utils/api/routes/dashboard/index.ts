import { API, dashboardSnapshotSchema } from "@ndb/platform";
import { apiRequest } from "@web/utils/api/client";
import { withSessionToken } from "@web/utils/api/routes/auth";
import type { DashboardSnapshotApi } from "@web/utils/api/routes/dashboard/types";

export async function fetchDashboard(from?: string, to?: string): Promise<DashboardSnapshotApi> {
  const response = await withSessionToken((sessionToken) =>
    apiRequest(API.dashboard.get, {
      sessionToken,
      params: { from, to },
      schema: dashboardSnapshotSchema,
    })
  );
  return response.data;
}
