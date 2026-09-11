import { expect, test } from "bun:test";
import {
  createRecoveryPhraseSlot,
  createVault,
  openField,
  rewrapVault,
  sealField,
  unlockVault,
  unlockVaultManual,
} from "@web/utils/crypto/vault";

const oldPassword = "password-old-123";
const newPassword = "password-new-456";
const phraseOne =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
const phraseTwo = "legal winner thank year wave sausage worth useful legal winner thank yellow";

test("rewrap password slot and open sealed field", async () => {
  const { dek, slots } = await createVault(oldPassword);
  const blob = await sealField(dek, "Alice");
  const wrapped = await rewrapVault(dek, newPassword);
  const passwordSlot = slots[0];
  if (!passwordSlot) {
    throw new Error("missing password slot");
  }
  passwordSlot.salt = wrapped.salt;
  passwordSlot.wrap_blob = wrapped.wrap_blob;

  const unlocked = await unlockVault(newPassword, [passwordSlot]);
  const name = await openField(unlocked, blob);
  expect(name).toBe("Alice");

  await expect(unlockVault(oldPassword, [passwordSlot])).rejects.toThrow();
});

test("multiple recovery phrase slots unlock with either phrase", async () => {
  const { dek, slots: passwordSlots } = await createVault("login-password-123");
  const blob = await sealField(dek, "Bob");
  const slotOne = await createRecoveryPhraseSlot(dek, phraseOne);
  const slotTwo = await createRecoveryPhraseSlot(dek, phraseTwo);
  const slots = [...passwordSlots, slotOne, slotTwo];

  const fromOne = await unlockVaultManual(slots, { recoveryPhrase: phraseOne });
  expect(await openField(fromOne, blob)).toBe("Bob");

  const fromTwo = await unlockVaultManual(slots, { recoveryPhrase: phraseTwo });
  expect(await openField(fromTwo, blob)).toBe("Bob");
});
