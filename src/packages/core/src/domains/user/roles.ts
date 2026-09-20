export const ROLES = ["user", "manager", "administrator"] as const;

export type Role = (typeof ROLES)[number];
