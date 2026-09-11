import type { WebAuthnCredential } from "@core/domains/auth/entities/webauthn-credential";
import type { Pagination, Sort } from "@core/shared/query";

export type WebAuthnCredentialFilters = {
  id?: string;
  userId?: string;
  credentialId?: Buffer;
};

export type WebAuthnCredentialSortColumn = "createdAt";

export type WebAuthnCredentialUpdate = {
  signCount?: number;
  backupState?: boolean;
};

export interface WebAuthnCredentialRepository {
  create(credential: WebAuthnCredential): Promise<WebAuthnCredential>;
  findById(id: string): Promise<WebAuthnCredential | null>;
  findByFilters(
    filters: WebAuthnCredentialFilters,
    sort?: Sort<WebAuthnCredentialSortColumn>,
    pagination?: Pagination
  ): Promise<WebAuthnCredential[]>;
  save(credential: WebAuthnCredential): Promise<WebAuthnCredential>;
  update(
    filters: WebAuthnCredentialFilters,
    patch: WebAuthnCredentialUpdate
  ): Promise<WebAuthnCredential[]>;
  aggregate(filters: WebAuthnCredentialFilters): Promise<number>;
  delete(filters: WebAuthnCredentialFilters): Promise<void>;
}
