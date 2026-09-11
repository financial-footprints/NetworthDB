import { randomBytes } from "node:crypto";
import { parseStorageEnv } from "@database/env";
import { users } from "@database/schema/users/index";
import type { DbClient } from "@database/types";
import { EntityNotFoundError } from "@ndb/core";
import {
  DATA_KEY_LEN,
  decrypt as decryptBlob,
  encrypt as encryptBlob,
  isEncrypted,
} from "@ndb/encryption";
import { eq } from "drizzle-orm";

export class Cryptography {
  private _getKey(): Buffer {
    const { encryption } = parseStorageEnv();
    if (!encryption.key) {
      throw new Error("database.storage.blob.invalid.master-key-required");
    }

    return encryption.key;
  }

  private async _getUser(db: DbClient, userId: string) {
    const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const row = rows[0];
    if (!row) {
      throw new EntityNotFoundError("database.user.find.not-found", {
        entityName: "User",
        id: userId,
      });
    }

    return row;
  }

  async encrypt(db: DbClient, userId: string, plaintext: Buffer): Promise<Buffer> {
    const { encryption } = parseStorageEnv();
    if (!encryption.enabled) {
      return plaintext;
    }

    const dataKey = await this.ensureDataKey(db, userId);
    return encryptBlob(dataKey, plaintext);
  }

  async decrypt(db: DbClient, userId: string, blob: Buffer): Promise<Buffer> {
    const { encryption } = parseStorageEnv();
    if (!encryption.enabled) {
      return blob;
    }

    if (!isEncrypted(blob)) {
      return blob;
    }

    const dataKey = await this.loadDataKey(db, userId);
    return decryptBlob(dataKey, blob);
  }

  async loadDataKey(db: DbClient, userId: string): Promise<Buffer> {
    const masterKey = this._getKey();
    const row = await this._getUser(db, userId);
    if (!row.encryptionSecret) {
      throw new Error(`database.storage.user-data-key.not-initialized.${userId}`);
    }

    return decryptBlob(masterKey, row.encryptionSecret);
  }

  async ensureDataKey(db: DbClient, userId: string): Promise<Buffer> {
    const masterKey = this._getKey();
    const row = await this._getUser(db, userId);
    if (row.encryptionSecret) {
      return decryptBlob(masterKey, row.encryptionSecret);
    }

    const dataKey = randomBytes(DATA_KEY_LEN);
    const wrapped = encryptBlob(masterKey, dataKey);
    await db.update(users).set({ encryptionSecret: wrapped }).where(eq(users.id, userId));
    return dataKey;
  }
}

export const cryptography = new Cryptography();
