import type { Category } from "@ndb/core";
import { categoryListSchema, categorySchema } from "@ndb/platform";

function serializeCategoryData(category: Category) {
  return {
    id: category.id,
    parentId: category.parentId,
    name: category.name,
    createdAt: category.createdAt,
    updatedAt: category.updatedAt,
  };
}

export function serializeCategory(category: Category) {
  return categorySchema.parse({
    data: serializeCategoryData(category),
  });
}

export function serializeCategoryList(items: Category[], total: number) {
  return categoryListSchema.parse({
    items: items.map((category) => serializeCategoryData(category)),
    total,
  });
}
