import type {
  MeDetailsApi,
  patchMeReqSchema,
  SessionTokenApi,
  userSchema,
  vaultAddSlotReqSchema,
  vaultInitReqSchema,
} from "@ndb/platform";
import type { ListData, Pagination } from "@web/utils/api/types";
import type { z } from "zod";

export type TokenPair = SessionTokenApi;

export type VaultSlot = MeDetailsApi["vaultSlots"][number];

export type MeResponse = MeDetailsApi;

export type AuthUser = Pick<
  MeDetailsApi,
  | "id"
  | "username"
  | "role"
  | "multifactorEnabled"
  | "multifactorMethods"
  | "recoveryCodesEnabled"
  | "recoveryEmailEnabled"
  | "displayName"
>;

export type PatchMePayload = z.infer<typeof patchMeReqSchema>;

export type VaultSlotPayload = z.infer<typeof vaultAddSlotReqSchema>;

export type VaultInitializePayload = z.input<typeof vaultInitReqSchema>;

export type RecoveryEmailPayload = {
  recoveryEmail?: string | null;
  currentPassword: string;
  totp?: string;
  recoveryCode?: string;
};

export type { LoginResult } from "@ndb/platform";

export type ListedUser = z.infer<typeof userSchema>["data"];

export type RegisterUserPayload = {
  username: string;
  password: string;
  role?: string;
};

export type RegisterUserResponse = ListedUser;

export type ListUsersResponse = ListData<ListedUser>;

type ListUsersFilters = {
  multifactorEnabled?: boolean;
  role?: string;
};

export type ListUsersParams = {
  pagination?: Pagination;
  filters?: ListUsersFilters;
  search?: string;
};

export type MfaFilter = "all" | "enabled" | "disabled";

export type RoleFilter = "all" | "user" | "manager" | "administrator";

const ROLES = {
  USER: "user",
  MANAGER: "manager",
  ADMINISTRATOR: "administrator",
} as const;

export function canListUsers(role: string): boolean {
  return role === ROLES.ADMINISTRATOR || role === ROLES.MANAGER;
}

export function canCreateUsers(role: string): boolean {
  return role === ROLES.ADMINISTRATOR;
}

export function canDeleteUsers(role: string): boolean {
  return role === ROLES.ADMINISTRATOR;
}
