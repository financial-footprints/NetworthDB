import type { Tag } from "@ndb/core";
import { tagListSchema, tagSchema } from "@ndb/platform";

function serializeTagData(tag: Tag) {
  return {
    id: tag.id,
    name: tag.name,
    createdAt: tag.createdAt,
    updatedAt: tag.updatedAt,
  };
}

export function serializeTag(tag: Tag) {
  return tagSchema.parse({
    data: serializeTagData(tag),
  });
}

export function serializeTagList(items: Tag[], total: number) {
  return tagListSchema.parse({
    items: items.map((tag) => serializeTagData(tag)),
    total,
  });
}
