import {
  applyPagination,
  applySort,
  bufferToText,
  textToBuffer,
} from "@database/repositories/helpers";
import { authWebauthnCreds } from "@database/schema/auth/webauthn-credentials";
import type { DbClient } from "@database/types";
import {
  ONE,
  type Pagination,
  type Sort,
  WebAuthnCredential,
  type WebAuthnCredentialFilters,
  type WebAuthnCredentialRepository,
  type WebAuthnCredentialSortColumn,
  type WebAuthnCredentialUpdate,
} from "@ndb/core";
import { and, count, eq, type SQL } from "drizzle-orm";

function mapRow(row: typeof authWebauthnCreds.$inferSelect): WebAuthnCredential {
  return new WebAuthnCredential(
    row.id,
    row.userId,
    textToBuffer<string, Buffer>(row.credentialId, "base64url"),
    textToBuffer<string, Buffer>(row.publicKey, "base64url"),
    row.attestationType,
    row.transport,
    row.signCount,
    row.backupEligible,
    row.backupState,
    row.name,
    textToBuffer<string, Buffer>(row.aaguid, "base64url"),
    row.createdAt
  );
}

function toValues(credential: WebAuthnCredential) {
  return {
    id: credential.id,
    userId: credential.userId,
    credentialId: bufferToText<Buffer, string>(credential.credentialId, "base64url"),
    publicKey: bufferToText<Buffer, string>(credential.publicKey, "base64url"),
    attestationType: credential.attestationType,
    transport: credential.transport,
    signCount: credential.signCount,
    backupEligible: credential.backupEligible,
    backupState: credential.backupState,
    name: credential.name,
    aaguid: bufferToText<Buffer, string>(credential.aaguid, "base64url"),
    createdAt: credential.createdAt,
  };
}

export class DrizzleWebAuthnCredsRepository implements WebAuthnCredentialRepository {
  constructor(private readonly db: DbClient) {}

  async create(credential: WebAuthnCredential): Promise<WebAuthnCredential> {
    const rows = await this.db.insert(authWebauthnCreds).values(toValues(credential)).returning();
    const row = rows[0];
    if (!row) {
      throw new Error("database.auth.webauthn-credential.create.error.no-row");
    }

    return mapRow(row);
  }

  async findById(id: string): Promise<WebAuthnCredential | null> {
    const rows = await this.findByFilters({ id }, undefined, ONE);
    return rows[0] ?? null;
  }

  async findByFilters(
    filters: WebAuthnCredentialFilters,
    sort?: Sort<WebAuthnCredentialSortColumn>,
    pagination?: Pagination
  ): Promise<WebAuthnCredential[]> {
    const where = this._filter(filters);
    const orderBy = applySort<WebAuthnCredentialSortColumn>(
      { createdAt: authWebauthnCreds.createdAt },
      sort
    );
    let query = this.db.select().from(authWebauthnCreds).$dynamic();
    if (where) {
      query = query.where(where);
    }
    if (orderBy) {
      query = query.orderBy(orderBy);
    }
    const rows = await applyPagination(query, pagination);
    return rows.map(mapRow);
  }

  async save(credential: WebAuthnCredential): Promise<WebAuthnCredential> {
    const rows = await this.db
      .update(authWebauthnCreds)
      .set({
        signCount: credential.signCount,
        backupState: credential.backupState,
      })
      .where(eq(authWebauthnCreds.id, credential.id))
      .returning();
    const row = rows[0];
    if (!row) {
      throw new Error("database.auth.webauthn-credential.save.error.no-row");
    }

    return mapRow(row);
  }

  async update(
    filters: WebAuthnCredentialFilters,
    patch: WebAuthnCredentialUpdate
  ): Promise<WebAuthnCredential[]> {
    const where = this._filter(filters);
    if (!where) {
      return [];
    }

    const rows = await this.db.update(authWebauthnCreds).set(patch).where(where).returning();
    return rows.map(mapRow);
  }

  async aggregate(filters: WebAuthnCredentialFilters): Promise<number> {
    const where = this._filter(filters);
    const rows = await this.db.select({ value: count() }).from(authWebauthnCreds).where(where);
    return Number(rows[0]?.value ?? 0);
  }

  async delete(filters: WebAuthnCredentialFilters): Promise<void> {
    const where = this._filter(filters);
    if (where) {
      await this.db.delete(authWebauthnCreds).where(where);
    }
  }

  private _filter(filters: WebAuthnCredentialFilters): SQL | undefined {
    const conditions: SQL[] = [];

    if (filters.id !== undefined) {
      conditions.push(eq(authWebauthnCreds.id, filters.id));
    }
    if (filters.userId !== undefined) {
      conditions.push(eq(authWebauthnCreds.userId, filters.userId));
    }
    if (filters.credentialId !== undefined) {
      conditions.push(
        eq(
          authWebauthnCreds.credentialId,
          bufferToText<Buffer, string>(filters.credentialId, "base64url")
        )
      );
    }

    if (conditions.length === 0) {
      return undefined;
    }

    return and(...conditions);
  }
}
