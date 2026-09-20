export type TagApi = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateTagBody = {
  name: string;
};

export type PatchTagBody = {
  name: string;
};
