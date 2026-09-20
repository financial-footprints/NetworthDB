export type SessionTokenPair = {
  sessionToken: string;
  refreshToken: string;
  expiresIn: number;
};

export type MultifactorChallengeResponse = {
  status: string;
  multifactorToken: string;
  expiresIn: number;
  methods: string[];
};

export type TotpBeginResponse = {
  uri: string;
};

export type RecoveryCodesResponse = {
  recoveryCodes: string[];
};

export type AdvancedRecoveryContextResponse = {
  vaultInitialized: boolean;
  vaultRecoveryMethods: string[];
};

export type VaultSlotResponse = {
  id?: string;
  slotType: string;
  salt: string;
  wrapBlob: string;
  credentialId: string | null;
  label?: string;
};

export type VaultInitializeResponse = {
  vaultSlots: VaultSlotResponse[];
};

export type UserResponse = {
  id: string;
  username: string;
  role: string;
  createdAt?: string;
  multifactorEnabled: boolean;
  multifactorMethods: string[];
  recoveryCodesEnabled: boolean;
  recoveryEmailEnabled: boolean;
  recoveryEmailSetAt: string | null;
  vaultInitialized: boolean;
  vaultSlots: Array<{
    id?: string;
    slotType: string;
    salt?: string;
    wrapBlob?: string;
    label?: string;
  }>;
  displayName: string | null;
  clientSettings: Record<string, unknown> | null;
};

export type ApiDataEnvelope<T> = { data: T };

export async function readApiJson<T>(response: Response): Promise<T> {
  return response.json() as Promise<T>;
}

export async function readApiData<T>(response: Response): Promise<T> {
  const body = await readApiJson<ApiDataEnvelope<T>>(response);
  return body.data;
}

export type SystemAccountListItem = {
  id: string;
  accountType: string;
  label?: string;
};

export type SystemAccountsData = {
  items: SystemAccountListItem[];
};

export async function readSystemAccountsData(response: Response): Promise<SystemAccountsData> {
  return readApiData<SystemAccountsData>(response);
}

export function systemAccountId(items: SystemAccountListItem[], accountType: string): string {
  const id = items.find((item) => item.accountType === accountType)?.id;
  if (!id) {
    throw new Error(`system account missing: ${accountType}`);
  }
  return id;
}
