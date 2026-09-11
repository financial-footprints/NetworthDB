import {
  applyPagination,
  applySort,
  bufferToText,
  isUniqueViolation,
  textToBuffer,
} from "@database/repositories/helpers";
import { usersVault } from "@database/schema/users/vault";
import type { DbClient } from "@database/types";
import {
  ConflictError,
  ONE,
  type Pagination,
  type Sort,
  VaultSlot,
  type VaultSlotFilters,
  type VaultSlotRepository,
  type VaultSlotSortColumn,
  type VaultSlotUpdate,
} from "@ndb/core";
import { and, count, eq, type SQL } from "drizzle-orm";

function mapRow(row: typeof usersVault.$inferSelect): VaultSlot {
  return new VaultSlot(
    row.id,
    row.userId,
    row.slotType,
    row.salt,
    row.wrapBlob,
    row.label,
    textToBuffer<string | null, Buffer | null>(row.credentialId, "base64url"),
    row.createdAt,
    row.updatedAt
  );
}

function toValues(slot: VaultSlot) {
  return {
    id: slot.id,
    userId: slot.userId,
    slotType: slot.slotType,
    salt: slot.salt,
    wrapBlob: slot.wrapBlob,
    label: slot.label,
    credentialId: bufferToText<Buffer | null, string | null>(slot.credentialId, "base64url"),
    createdAt: slot.createdAt,
    updatedAt: slot.updatedAt,
  };
}

export class DrizzleVaultSlotRepository implements VaultSlotRepository {
  constructor(private readonly db: DbClient) {}

  async create(slots: VaultSlot | VaultSlot[]): Promise<VaultSlot | VaultSlot[]> {
    const items = Array.isArray(slots) ? slots : [slots];
    if (items.length === 0) {
      return [];
    }

    try {
      const rows = await this.db.insert(usersVault).values(items.map(toValues)).returning();
      const mapped = rows.map(mapRow);
      if (Array.isArray(slots)) {
        return mapped;
      }

      const created = mapped[0];
      if (!created) {
        throw new Error("database.vault.slot.create.error.no-row");
      }

      return created;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictError("database.vault.slot.create.conflict.duplicate");
      }

      throw error;
    }
  }

  async findById(id: string): Promise<VaultSlot | null> {
    const rows = await this.findByFilters({ id }, undefined, ONE);
    return rows[0] ?? null;
  }

  async findByFilters(
    filters: VaultSlotFilters,
    sort?: Sort<VaultSlotSortColumn>,
    pagination?: Pagination
  ): Promise<VaultSlot[]> {
    const where = this._filter(filters);
    const orderBy = applySort<VaultSlotSortColumn>(
      { createdAt: usersVault.createdAt, updatedAt: usersVault.updatedAt },
      sort
    );
    let query = this.db.select().from(usersVault).$dynamic();
    if (where) {
      query = query.where(where);
    }
    if (orderBy) {
      query = query.orderBy(orderBy);
    }
    const rows = await applyPagination(query, pagination);
    return rows.map(mapRow);
  }

  async update(filters: VaultSlotFilters, patch: VaultSlotUpdate): Promise<VaultSlot[]> {
    const where = this._filter(filters);
    if (!where) {
      return [];
    }

    const rows = await this.db.update(usersVault).set(patch).where(where).returning();
    return rows.map(mapRow);
  }

  async aggregate(filters: VaultSlotFilters): Promise<number> {
    const where = this._filter(filters);
    const rows = await this.db.select({ value: count() }).from(usersVault).where(where);
    return Number(rows[0]?.value ?? 0);
  }

  async delete(filters: VaultSlotFilters): Promise<void> {
    const where = this._filter(filters);
    if (where) {
      await this.db.delete(usersVault).where(where);
    }
  }

  private _filter(filters: VaultSlotFilters): SQL | undefined {
    const conditions: SQL[] = [];

    if (filters.id !== undefined) {
      conditions.push(eq(usersVault.id, filters.id));
    }
    if (filters.userId !== undefined) {
      conditions.push(eq(usersVault.userId, filters.userId));
    }
    if (filters.credentialId !== undefined) {
      conditions.push(
        eq(usersVault.credentialId, bufferToText<Buffer, string>(filters.credentialId, "base64url"))
      );
    }
    if (filters.slotType !== undefined) {
      conditions.push(eq(usersVault.slotType, filters.slotType));
    }

    if (conditions.length === 0) {
      return undefined;
    }

    return and(...conditions);
  }
}
