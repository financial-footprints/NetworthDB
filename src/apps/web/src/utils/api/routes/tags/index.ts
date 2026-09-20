import { API, apiPath, tagListSchema, tagSchema } from "@ndb/platform";
import { apiRequest } from "@web/utils/api/client";
import { withSessionToken } from "@web/utils/api/routes/auth";
import type { CreateTagBody, PatchTagBody, TagApi } from "@web/utils/api/routes/tags/types";

export async function fetchTags(params?: {
  q?: string;
  limit?: number;
  offset?: number;
}): Promise<{ items: TagApi[]; total: number }> {
  return withSessionToken((sessionToken) =>
    apiRequest(API.tags.list, { sessionToken, params, schema: tagListSchema })
  );
}

export async function createTag(body: CreateTagBody): Promise<TagApi> {
  const response = await withSessionToken((sessionToken) =>
    apiRequest(API.tags.create, {
      method: "POST",
      sessionToken,
      body,
      schema: tagSchema,
    })
  );
  return response.data;
}

export async function updateTag(tagId: string, body: PatchTagBody): Promise<TagApi> {
  const response = await withSessionToken((sessionToken) =>
    apiRequest(apiPath(API.tags.patch, { tagId }), {
      method: "PATCH",
      sessionToken,
      body,
      schema: tagSchema,
    })
  );
  return response.data;
}

export async function deleteTag(tagId: string): Promise<void> {
  await withSessionToken((sessionToken) =>
    apiRequest(apiPath(API.tags.delete, { tagId }), { method: "DELETE", sessionToken })
  );
}
