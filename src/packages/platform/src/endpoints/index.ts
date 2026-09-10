export const API = {
  health: {
    get: "/health",
  },
} as const;

type ApiPathLeaf<T> = T extends string ? T : { [K in keyof T]: ApiPathLeaf<T[K]> }[keyof T];

export type ApiPath = ApiPathLeaf<typeof API>;
