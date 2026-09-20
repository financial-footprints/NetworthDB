export type CategoryApi = {
  id: string;
  parentId: string | null;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateCategoryBody = {
  name: string;
  parentId: string | null;
};

export type PatchCategoryBody = {
  name: string;
};
