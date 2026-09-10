import type { VaultSlot } from "@core/domains/user/modules/vault/entities/vault-slot";
import type {
  VaultSlotFilters,
  VaultSlotRepository,
  VaultSlotSortColumn,
  VaultSlotUpdate,
} from "@core/domains/user/modules/vault/repositories/vault-slot-repository";
import type { Pagination, Sort } from "@core/shared/query";
import { paginate, sortByColumn } from "@tests/core/fakes/repository-helpers";

export class InMemoryVaultSlotRepository implements VaultSlotRepository {
  private readonly byId = new Map<string, VaultSlot>();

  async create(slots: VaultSlot | VaultSlot[]): Promise<VaultSlot | VaultSlot[]> {
    const items = Array.isArray(slots) ? slots : [slots];
    for (const slot of items) {
      this.byId.set(slot.id, slot);
    }

    return slots;
  }

  async findById(id: string): Promise<VaultSlot | null> {
    return this.byId.get(id) ?? null;
  }

  async findByFilters(
    filters: VaultSlotFilters,
    sort?: Sort<VaultSlotSortColumn>,
    pagination?: Pagination
  ): Promise<VaultSlot[]> {
    let items = [...this.byId.values()].filter((slot) => this.matches(slot, filters));
    items = sortByColumn(
      items,
      {
        createdAt: (slot) => slot.createdAt,
        updatedAt: (slot) => slot.updatedAt,
      },
      sort
    );
    return paginate(items, pagination);
  }

  async update(filters: VaultSlotFilters, patch: VaultSlotUpdate): Promise<VaultSlot[]> {
    const updated: VaultSlot[] = [];
    for (const [id, slot] of this.byId.entries()) {
      if (!this.matches(slot, filters)) {
        continue;
      }

      const next = slot.withWrap(
        patch.salt ?? slot.salt,
        patch.wrapBlob ?? slot.wrapBlob,
        patch.updatedAt ?? slot.updatedAt
      );
      this.byId.set(id, next);
      updated.push(next);
    }

    return updated;
  }

  async aggregate(filters: VaultSlotFilters): Promise<number> {
    return [...this.byId.values()].filter((slot) => this.matches(slot, filters)).length;
  }

  async delete(filters: VaultSlotFilters): Promise<void> {
    for (const [id, slot] of this.byId.entries()) {
      if (this.matches(slot, filters)) {
        this.byId.delete(id);
      }
    }
  }

  private matches(slot: VaultSlot, filters: VaultSlotFilters): boolean {
    if (filters.id !== undefined && slot.id !== filters.id) {
      return false;
    }
    if (filters.userId !== undefined && slot.userId !== filters.userId) {
      return false;
    }
    if (
      filters.credentialId !== undefined &&
      (slot.credentialId === null || !slot.credentialId.equals(filters.credentialId))
    ) {
      return false;
    }
    if (filters.slotType !== undefined && slot.slotType !== filters.slotType) {
      return false;
    }

    return true;
  }
}
