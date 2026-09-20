import { useAuth } from "@web/contexts/Auth/Context";
import { useNotifications } from "@web/contexts/Notifications/Context";
import { withSessionToken } from "@web/utils/api/routes/auth";
import type { E2eeFieldId } from "@web/utils/crypto/client-settings";
import { isE2eeEnabled, parseClientSettings } from "@web/utils/crypto/client-settings";
import { rewriteE2eeFieldStorage } from "@web/utils/crypto/rewrite";
import { readDEK } from "@web/utils/crypto/session";
import { unlockVault } from "@web/utils/crypto/vault";
import { errorMessage } from "@web/utils/errors";
import { useCallback, useState } from "react";

type PendingToggle = {
  fieldId: E2eeFieldId;
  fieldLabel: string;
  enable: boolean;
};

export function useE2eeFieldToggle() {
  const { me, applyMe, completeVaultUnlock } = useAuth();
  const { pushNotification } = useNotifications();
  const [pending, setPending] = useState<PendingToggle | null>(null);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [vaultPasswordOpen, setVaultPasswordOpen] = useState(false);

  const settings = parseClientSettings(me?.clientSettings ?? null);

  const requestToggle = useCallback(
    (fieldId: E2eeFieldId, fieldLabel: string) => {
      const currentlyEnabled = isE2eeEnabled(settings, fieldId);
      setErrors([]);
      setPending({
        fieldId,
        fieldLabel,
        enable: !currentlyEnabled,
      });
    },
    [settings]
  );

  const closeModal = useCallback(() => {
    if (!busy) {
      setPending(null);
      setErrors([]);
    }
  }, [busy]);

  const runRewrite = useCallback(
    async (password?: string) => {
      if (!pending || !me) {
        return;
      }

      setBusy(true);
      setErrors([]);
      try {
        await withSessionToken(async (sessionToken) => {
          let dek = await readDEK();
          if (!dek) {
            if (!password) {
              setVaultPasswordOpen(true);
              setBusy(false);
              return;
            }
            dek = await unlockVault(password, me.vaultSlots);
            await completeVaultUnlock(dek, me);
            setVaultPasswordOpen(false);
          }

          const nextMe = await rewriteE2eeFieldStorage(
            sessionToken,
            me,
            dek,
            pending.fieldId,
            pending.enable
          );
          await applyMe(nextMe);
          pushNotification(
            pending.enable
              ? `End-to-end encryption is enabled for ${pending.fieldLabel}.`
              : `End-to-end encryption is disabled for ${pending.fieldLabel}.`,
            "success"
          );
          setPending(null);
        });
      } catch (error) {
        setErrors([errorMessage(error, "Could not update field encryption.")]);
      } finally {
        setBusy(false);
      }
    },
    [applyMe, completeVaultUnlock, me, pending, pushNotification]
  );

  const confirmToggle = useCallback(async () => {
    if (!pending || !me) {
      return;
    }
    const dek = await readDEK();
    if (!dek) {
      setVaultPasswordOpen(true);
      return;
    }
    void runRewrite();
  }, [me, pending, runRewrite]);

  return {
    settings,
    requestToggle,
    pending,
    busy,
    errors,
    closeModal,
    confirmToggle,
    vaultPasswordOpen,
    setVaultPasswordOpen,
    runRewriteWithPassword: (password: string) => {
      void runRewrite(password);
    },
  };
}
