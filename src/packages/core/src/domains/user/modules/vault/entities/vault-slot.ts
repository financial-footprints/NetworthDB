import type { VaultSlotType } from "@core/domains/user/modules/vault/embedded/vault-wrap";

export class VaultSlot {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly slotType: VaultSlotType,
    public readonly salt: string,
    public readonly wrapBlob: string,
    public readonly label: string,
    public readonly credentialId: Buffer | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  withWrap(salt: string, wrapBlob: string, updatedAt: Date): VaultSlot {
    return new VaultSlot(
      this.id,
      this.userId,
      this.slotType,
      salt,
      wrapBlob,
      this.label,
      this.credentialId,
      this.createdAt,
      updatedAt
    );
  }
}
