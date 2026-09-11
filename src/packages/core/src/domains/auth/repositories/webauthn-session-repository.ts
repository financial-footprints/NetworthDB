import type { WebAuthnSession } from "@core/domains/auth/entities/webauthn-session";
import type { Pagination, Sort } from "@core/shared/query";

export type WebAuthnSessionFilters = {
  id?: string;
  userId?: string;
};

export type WebAuthnSessionSortColumn = "createdAt" | "expiresAt";

export interface WebAuthnSessionRepository {
  create(session: WebAuthnSession): Promise<WebAuthnSession>;
  findById(id: string): Promise<WebAuthnSession | null>;
  findByFilters(
    filters: WebAuthnSessionFilters,
    sort?: Sort<WebAuthnSessionSortColumn>,
    pagination?: Pagination
  ): Promise<WebAuthnSession[]>;
  delete(filters: WebAuthnSessionFilters): Promise<void>;
}
