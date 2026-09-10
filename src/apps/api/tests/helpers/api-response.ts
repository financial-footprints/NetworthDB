export type ApiEnvelope<T> = {
  data: T;
  errors: unknown[];
};

export type SessionTokenPair = {
  token_type: string;
  session_token: string;
  refresh_token: string;
  expires_in: number;
};

export type MultifactorChallengeResponse = {
  status: string;
  multifactor_token: string;
  expires_in: number;
  methods: string[];
};

export type TotpBeginResponse = {
  uri: string;
};

export type RecoveryCodesResponse = {
  recovery_codes: string[];
};

export type AdvancedRecoveryContextResponse = {
  e2ee_vault_initialized: boolean;
  vault_recovery_methods: string[];
};

export type VaultSlotResponse = {
  id: string;
  slot_type: string;
  salt: string;
  wrap_blob: string;
  credential_id: string | null;
  label?: string;
};

export type VaultInitializeResponse = {
  e2ee_slots: VaultSlotResponse[];
};

export type PublicUserResponse = {
  id: string;
  username: string;
  role: string;
  created_at?: string;
  multifactor_enabled: boolean;
  multifactor_methods: string[];
  recovery_codes_enabled: boolean;
  recovery_email_enabled: boolean;
  recovery_email_set_at: string | null;
  e2ee_vault_initialized: boolean;
  e2ee_slots: Array<{
    id?: string;
    slot_type: string;
    salt?: string;
    wrap_blob?: string;
    label?: string;
  }>;
  e2ee_name: string | null;
};

export async function readApiJson<T>(response: Response): Promise<ApiEnvelope<T>> {
  return response.json() as Promise<ApiEnvelope<T>>;
}
