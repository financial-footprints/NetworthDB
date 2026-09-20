import { API, apiPath, categoryListSchema, categorySchema } from "@ndb/platform";
import { apiRequest } from "@web/utils/api/client";
import { withSessionToken } from "@web/utils/api/routes/auth";
import type {
  CategoryApi,
  CreateCategoryBody,
  PatchCategoryBody,
} from "@web/utils/api/routes/categories/types";

export async function fetchCategories(params?: {
  q?: string;
  parentId?: string;
  limit?: number;
  offset?: number;
}): Promise<{ items: CategoryApi[]; total: number }> {
  return withSessionToken((sessionToken) =>
    apiRequest(API.categories.list, {
      sessionToken,
      params,
      schema: categoryListSchema,
    })
  );
}

export async function createCategory(body: CreateCategoryBody): Promise<CategoryApi> {
  const response = await withSessionToken((sessionToken) =>
    apiRequest(API.categories.create, {
      method: "POST",
      sessionToken,
      body,
      schema: categorySchema,
    })
  );
  return response.data;
}

export async function updateCategory(
  categoryId: string,
  body: PatchCategoryBody
): Promise<CategoryApi> {
  const response = await withSessionToken((sessionToken) =>
    apiRequest(apiPath(API.categories.patch, { categoryId }), {
      method: "PATCH",
      sessionToken,
      body,
      schema: categorySchema,
    })
  );
  return response.data;
}

export async function deleteCategory(categoryId: string): Promise<void> {
  await withSessionToken((sessionToken) =>
    apiRequest(apiPath(API.categories.delete, { categoryId }), {
      method: "DELETE",
      sessionToken,
    })
  );
}
