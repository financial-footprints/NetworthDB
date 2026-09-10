import { healthResponseSchema } from "@ndb/platform";

export function serializeHealth(ok: boolean) {
  return healthResponseSchema.parse({
    data: { ok },
    errors: [],
  });
}
