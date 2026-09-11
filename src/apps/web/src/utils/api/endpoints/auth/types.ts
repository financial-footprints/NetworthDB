import type { ListData, Pagination } from "@web/utils/api/types";

export type TokenPair = {
  session_token: string;
  refresh_token: string;
  expires_in: number;
};

export type VaultSlot = {
  id: string;
  slot_type: "password" | "recovery_phrase" | "webauthn_prf";
  salt: string;
  wrap_blob: string;
  credential_id: string | null;
  label: string;
};

export type MeResponse = {
  id: string;
  username: string;
  role: string;
  multifactor_enabled: boolean;
  multifactor_methods: string[];
  recovery_codes_enabled: boolean;
  recovery_email_enabled: boolean;
  recovery_email_set_at: string | null;
  vault_initialized: boolean;
  vault_slots: VaultSlot[];
  display_name: string | null;
};

export type AuthUser = {
  id: string;
  username: string;
  role: string;
  multifactor_enabled: boolean;
  multifactor_methods: string[];
  recovery_codes_enabled: boolean;
  recovery_email_enabled: boolean;
  displayName: string | null;
};

export type PatchMePayload = {
  username?: string;
  current_password?: string;
  new_password?: string;
  display_name?: string;
  recovery_email?: string | null;
};

export type VaultSlotPayload = {
  slot_type: "password" | "recovery_phrase" | "webauthn_prf";
  salt: string;
  wrap_blob: string;
  credential_id?: string | null;
  label?: string;
  password?: string;
};

export type VaultInitializePayload = {
  slots: VaultSlotPayload[];
  display_name?: string;
};

export type RecoveryEmailPayload = {
  recovery_email?: string | null;
  current_password: string;
  totp?: string;
  recovery_code?: string;
};

export type LoginResult =
  | { kind: "authenticated"; tokens: TokenPair }
  | {
      kind: "multifactor_required";
      multifactorToken: string;
      expiresIn: number;
      methods: string[];
    }
  | {
      kind: "multifactor_enrollment_required";
      multifactorToken: string;
      expiresIn: number;
      methods: string[];
    };

export type ListedUser = {
  id: string;
  username: string;
  role: string;
  created_at: string;
  multifactor_enabled: boolean;
};

export type RegisterUserPayload = {
  username: string;
  password: string;
  role?: string;
};

export type RegisterUserResponse = ListedUser;

export type ListUsersResponse = ListData<ListedUser>;

type ListUsersFilters = {
  multifactor_enabled?: boolean;
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
