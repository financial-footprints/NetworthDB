import { useAuth } from "@web/contexts/Auth/Context";
import { useNotifications } from "@web/contexts/Notifications/Context";
import {
  recoveryPhraseLabel,
  resolvePasskeyName,
} from "@web/contexts/Settings/components/encryption/labels";
import { VAULT_LOCKED_MESSAGE } from "@web/utils/api/helpers";
import {
  createVaultSlot,
  deleteVaultSlot,
  fetchMe,
  listWebAuthnCredentials,
  withSessionToken,
} from "@web/utils/api/routes/auth";
import type { WebAuthnCredential } from "@web/utils/api/routes/auth/mfa";
import type { VaultSlot } from "@web/utils/api/routes/auth/types";
import { ApiError } from "@web/utils/api/types";
import { randomBytes } from "@web/utils/crypto/aes";
import { readDEK } from "@web/utils/crypto/session";
import {
  createPasswordSlot,
  createRecoveryPhraseSlot,
  credentialIdsMatch,
  findPasswordSlot,
  registerVaultPrf,
  unlockVault,
  wrapDEKForSlot,
} from "@web/utils/crypto/vault";
import { errorMessage } from "@web/utils/errors";
import { useCallback, useEffect, useMemo, useState } from "react";

const MAX_RECOVERY_PHRASES = 10;

export function useVault() {
  const { user, me, vaultStatus, applyMe, completeVaultUnlock } = useAuth();
  const { pushNotification } = useNotifications();

  const [passkeys, setPasskeys] = useState<WebAuthnCredential[]>([]);
  const [passkeysLoading, setPasskeysLoading] = useState(false);

  const [vaultModalOpen, setVaultModalOpen] = useState(false);
  const [vaultModalErrors, setVaultModalErrors] = useState<string[]>([]);
  const [vaultModalBusy, setVaultModalBusy] = useState(false);

  const [removeSlot, setRemoveSlot] = useState<VaultSlot | null>(null);
  const [removeErrors, setRemoveErrors] = useState<string[]>([]);
  const [removeBusy, setRemoveBusy] = useState(false);

  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recoveryErrors, setRecoveryErrors] = useState<string[]>([]);
  const [recoveryBusy, setRecoveryBusy] = useState(false);

  const [passkeyOpen, setPasskeyOpen] = useState(false);
  const [passkeyErrors, setPasskeyErrors] = useState<string[]>([]);
  const [passkeyBusy, setPasskeyBusy] = useState(false);

  const [passwordSlotOpen, setPasswordSlotOpen] = useState(false);
  const [passwordSlotErrors, setPasswordSlotErrors] = useState<string[]>([]);
  const [passwordSlotBusy, setPasswordSlotBusy] = useState(false);

  const slots = me?.vaultSlots ?? [];
  const vaultInitialized = Boolean(me?.vaultInitialized);
  const vaultUnlocked = vaultStatus === "unlocked";
  const manageDisabled = !vaultUnlocked;
  const showRemove = slots.length > 1;

  const passwordSlot = findPasswordSlot(slots);
  const recoverySlots = useMemo(
    () => slots.filter((slot) => slot.slotType === "recovery_phrase"),
    [slots]
  );
  const prfSlots = useMemo(() => slots.filter((slot) => slot.slotType === "webauthn_prf"), [slots]);

  const eligiblePasskeys = useMemo(
    () =>
      passkeys.filter(
        (passkey) => !prfSlots.some((slot) => credentialIdsMatch(slot.credentialId, passkey.id))
      ),
    [passkeys, prfSlots]
  );

  const recoveryIndexById = useMemo(() => {
    const map = new Map<string, number>();
    recoverySlots.forEach((slot, index) => {
      map.set(slot.id, index);
    });
    return map;
  }, [recoverySlots]);

  const loadPasskeys = useCallback(async () => {
    if (!user?.multifactorEnabled) {
      setPasskeys([]);
      return;
    }
    setPasskeysLoading(true);
    try {
      const response = await withSessionToken((sessionToken) =>
        listWebAuthnCredentials(sessionToken)
      );
      setPasskeys(response.items);
    } catch {
      setPasskeys([]);
    } finally {
      setPasskeysLoading(false);
    }
  }, [user?.multifactorEnabled]);

  useEffect(() => {
    void loadPasskeys();
  }, [loadPasskeys]);

  async function refreshMe(): Promise<void> {
    await withSessionToken(async (sessionToken) => {
      await applyMe(await fetchMe(sessionToken));
    });
  }

  function vaultAuthError(error: unknown): string[] {
    if (error instanceof ApiError && error.status === 401) {
      return [
        "Password verification failed. If MFA is enabled, sign out and sign in with MFA before managing keys.",
      ];
    }
    if (error instanceof ApiError && (error.status === 409 || error.status === 422)) {
      return ["At least one decryption key is required."];
    }
    return [errorMessage(error, "Could not update decryption keys.")];
  }

  async function handleVaultUnlock(password: string) {
    if (!me) {
      return;
    }
    setVaultModalBusy(true);
    setVaultModalErrors([]);
    try {
      const dek = await unlockVault(password, me.vaultSlots);
      await completeVaultUnlock(dek, me);
      setVaultModalOpen(false);
    } catch {
      setVaultModalErrors([
        "Could not unlock vault. Check your password or use another key from the login page.",
      ]);
    } finally {
      setVaultModalBusy(false);
    }
  }

  async function handleRemoveConfirm(password: string) {
    if (!removeSlot) {
      return;
    }
    setRemoveBusy(true);
    setRemoveErrors([]);
    try {
      await withSessionToken((sessionToken) =>
        deleteVaultSlot(sessionToken, removeSlot.id, { password })
      );
      await refreshMe();
      setRemoveSlot(null);
      pushNotification("Decryption key removed.", "success");
    } catch (error) {
      setRemoveErrors(vaultAuthError(error));
    } finally {
      setRemoveBusy(false);
    }
  }

  async function handleRecoveryConfirm(phrase: string, label: string, password: string) {
    setRecoveryBusy(true);
    setRecoveryErrors([]);
    try {
      const dek = await readDEK();
      if (!dek) {
        throw new Error(VAULT_LOCKED_MESSAGE);
      }
      const slot = await createRecoveryPhraseSlot(dek, phrase);
      await withSessionToken((sessionToken) =>
        createVaultSlot(sessionToken, {
          slotType: "recovery_phrase",
          salt: slot.salt,
          wrapBlob: slot.wrapBlob,
          label: label || undefined,
          password,
        })
      );
      await refreshMe();
      setRecoveryOpen(false);
      pushNotification("Decryption key added.", "success");
    } catch (error) {
      setRecoveryErrors(vaultAuthError(error));
    } finally {
      setRecoveryBusy(false);
    }
  }

  async function handlePasskeyConfirm(
    passkey: WebAuthnCredential,
    label: string,
    password: string
  ) {
    setPasskeyBusy(true);
    setPasskeyErrors([]);
    try {
      const dek = await readDEK();
      if (!dek) {
        throw new Error(VAULT_LOCKED_MESSAGE);
      }
      const prfSalt = randomBytes(16);
      const evalSlot = prfSlots.length >= 1 ? "second" : "first";
      const prfOutput = await registerVaultPrf(passkey.id, prfSalt, evalSlot);
      const wrapped = await wrapDEKForSlot(dek, "webauthn_prf", prfOutput, prfSalt);
      await withSessionToken((sessionToken) =>
        createVaultSlot(sessionToken, {
          slotType: "webauthn_prf",
          salt: wrapped.salt,
          wrapBlob: wrapped.wrapBlob,
          credentialId: passkey.id,
          label,
          password,
        })
      );
      await refreshMe();
      setPasskeyOpen(false);
      pushNotification("Decryption key added.", "success");
    } catch (error) {
      setPasskeyErrors(vaultAuthError(error));
    } finally {
      setPasskeyBusy(false);
    }
  }

  async function handlePasswordSlotConfirm(password: string) {
    setPasswordSlotBusy(true);
    setPasswordSlotErrors([]);
    try {
      const dek = await readDEK();
      if (!dek) {
        throw new Error(VAULT_LOCKED_MESSAGE);
      }
      const slot = await createPasswordSlot(dek, password);
      await withSessionToken((sessionToken) =>
        createVaultSlot(sessionToken, {
          slotType: "password",
          salt: slot.salt,
          wrapBlob: slot.wrapBlob,
          password,
        })
      );
      await refreshMe();
      setPasswordSlotOpen(false);
      pushNotification("Decryption key added.", "success");
    } catch (error) {
      setPasswordSlotErrors(vaultAuthError(error));
    } finally {
      setPasswordSlotBusy(false);
    }
  }

  const removeSlotLabel = removeSlot
    ? removeSlot.slotType === "recovery_phrase"
      ? recoveryPhraseLabel(removeSlot, recoveryIndexById.get(removeSlot.id) ?? 0)
      : removeSlot.slotType === "webauthn_prf"
        ? resolvePasskeyName(removeSlot, passkeys)
        : "Login password"
    : "";

  const canAddPasswordSlot = passwordSlot === undefined;
  const canAddRecoveryPhrase = recoverySlots.length < MAX_RECOVERY_PHRASES;
  const canLinkPasskey = !passkeysLoading && eligiblePasskeys.length > 0;

  return {
    user,
    me,
    slots,
    passkeys,
    passkeysLoading,
    vaultInitialized,
    vaultUnlocked,
    manageDisabled,
    showRemove,
    prfSlots,
    eligiblePasskeys,
    recoveryIndexById,
    removeSlotLabel,
    canAddPasswordSlot,
    canAddRecoveryPhrase,
    canLinkPasskey,
    vaultModalOpen,
    setVaultModalOpen,
    vaultModalErrors,
    setVaultModalErrors,
    vaultModalBusy,
    handleVaultUnlock,
    removeSlot,
    setRemoveSlot,
    removeErrors,
    setRemoveErrors,
    removeBusy,
    handleRemoveConfirm,
    recoveryOpen,
    setRecoveryOpen,
    recoveryErrors,
    setRecoveryErrors,
    recoveryBusy,
    handleRecoveryConfirm,
    passkeyOpen,
    setPasskeyOpen,
    passkeyErrors,
    setPasskeyErrors,
    passkeyBusy,
    handlePasskeyConfirm,
    passwordSlotOpen,
    setPasswordSlotOpen,
    passwordSlotErrors,
    setPasswordSlotErrors,
    passwordSlotBusy,
    handlePasswordSlotConfirm,
  };
}
