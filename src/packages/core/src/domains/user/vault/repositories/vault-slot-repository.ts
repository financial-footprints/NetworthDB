import type { VaultSlotType } from "@core/domains/user/vault/constants";
import type { VaultSlot } from "@core/domains/user/vault/entities/vault-slot";
import type { Pagination, Sort } from "@core/shared/query";

export type VaultSlotFilters = {
  id?: string;
  userId?: string;
  credentialId?: Buffer;
  slotType?: VaultSlotType;
};

export type VaultSlotSortColumn = "createdAt" | "updatedAt";

export type VaultSlotUpdate = {
  salt?: string;
  wrapBlob?: string;
  updatedAt?: Date;
};

export interface VaultSlotRepository {
  create(slots: VaultSlot | VaultSlot[]): Promise<VaultSlot | VaultSlot[]>;
  findById(id: string): Promise<VaultSlot | null>;
  findByFilters(
    filters: VaultSlotFilters,
    sort?: Sort<VaultSlotSortColumn>,
    pagination?: Pagination
  ): Promise<VaultSlot[]>;
  update(filters: VaultSlotFilters, patch: VaultSlotUpdate): Promise<VaultSlot[]>;
  aggregate(filters: VaultSlotFilters): Promise<number>;
  delete(filters: VaultSlotFilters): Promise<void>;
}
