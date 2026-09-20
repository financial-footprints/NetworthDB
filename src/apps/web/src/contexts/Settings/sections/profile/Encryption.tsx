import { CalloutSummary } from "@web/components/Badge/CalloutSummary";
import { SecondaryButton } from "@web/components/Button";
import { Card } from "@web/contexts/Settings/components/Card";
import { ENCRYPTION_DESCRIPTION } from "@web/contexts/Settings/components/encryption/description";
import { slotSubtitle, slotTitle } from "@web/contexts/Settings/components/encryption/labels";
import { Overview } from "@web/contexts/Settings/components/encryption/Overview";
import { VaultSlotRow } from "@web/contexts/Settings/components/encryption/VaultSlotRow";
import { AddPasskeyVaultModal } from "@web/contexts/Settings/modals/encryption/AddPasskeyVaultModal";
import { AddPasswordSlotModal } from "@web/contexts/Settings/modals/encryption/AddPasswordSlotModal";
import { AddRecoveryPhraseModal } from "@web/contexts/Settings/modals/encryption/AddRecoveryPhraseModal";
import { RemoveVaultSlotModal } from "@web/contexts/Settings/modals/encryption/RemoveVaultSlotModal";
import { VaultPasswordModal } from "@web/contexts/Settings/modals/encryption/VaultPasswordModal";
import { useVault } from "@web/contexts/Settings/sections/profile/vault";
import type { WebAuthnCredential } from "@web/utils/api/routes/auth/mfa";
import type { VaultSlot } from "@web/utils/api/routes/auth/types";

function EncryptionUninitializedView() {
  return (
    <Card title="Encryption" description={ENCRYPTION_DESCRIPTION}>
      <CalloutSummary variant="warning">
        Sign out and sign in again to finish encryption setup.
      </CalloutSummary>
      <div className="border-t border-slate-100 pt-6">
        <Overview />
      </div>
    </Card>
  );
}

type VaultSlotsPanelProps = {
  vaultUnlocked: boolean;
  manageDisabled: boolean;
  passkeysLoading: boolean;
  multifactorEnabled: boolean;
  passkeys: WebAuthnCredential[];
  prfSlots: VaultSlot[];
  slots: VaultSlot[];
  recoveryIndexById: Map<string, number>;
  showRemove: boolean;
  canAddPasswordSlot: boolean;
  canAddRecoveryPhrase: boolean;
  canLinkPasskey: boolean;
  onUnlockClick: () => void;
  onRemoveSlot: (slot: VaultSlot) => void;
  onAddPasswordSlot: () => void;
  onAddRecoveryPhrase: () => void;
  onLinkPasskey: () => void;
};

function VaultSlotsPanel({
  vaultUnlocked,
  manageDisabled,
  passkeysLoading,
  multifactorEnabled,
  passkeys,
  prfSlots,
  slots,
  recoveryIndexById,
  showRemove,
  canAddPasswordSlot,
  canAddRecoveryPhrase,
  canLinkPasskey,
  onUnlockClick,
  onRemoveSlot,
  onAddPasswordSlot,
  onAddRecoveryPhrase,
  onLinkPasskey,
}: VaultSlotsPanelProps) {
  return (
    <div className="space-y-6">
      {!vaultUnlocked ? (
        <div className="flex justify-end">
          <SecondaryButton type="button" onClick={onUnlockClick}>
            Unlock vault
          </SecondaryButton>
        </div>
      ) : null}

      <div className={`space-y-4 ${vaultUnlocked ? "" : "border-t border-slate-100 pt-6"}`}>
        {manageDisabled ? (
          <p className="text-sm text-slate-500">Unlock the vault to manage keys.</p>
        ) : null}

        {passkeysLoading ? (
          <p className="text-sm text-slate-500" aria-busy="true">
            Loading passkeys…
          </p>
        ) : null}

        {!passkeysLoading &&
        multifactorEnabled &&
        passkeys.length === 0 &&
        prfSlots.length === 0 ? (
          <p className="text-sm text-slate-500">
            Register a passkey under Security first to link one here.
          </p>
        ) : null}

        {slots.map((slot) => (
          <VaultSlotRow
            key={slot.id}
            title={slotTitle(slot, passkeys, recoveryIndexById.get(slot.id) ?? 0)}
            subtitle={slotSubtitle(slot)}
            showRemove={showRemove}
            manageDisabled={manageDisabled}
            onRemove={() => onRemoveSlot(slot)}
          />
        ))}

        {canAddPasswordSlot || canAddRecoveryPhrase || canLinkPasskey ? (
          <div className="flex flex-wrap gap-2">
            {canAddPasswordSlot ? (
              <SecondaryButton type="button" disabled={manageDisabled} onClick={onAddPasswordSlot}>
                Link Login Password
              </SecondaryButton>
            ) : null}

            {canAddRecoveryPhrase ? (
              <SecondaryButton
                type="button"
                disabled={manageDisabled}
                onClick={onAddRecoveryPhrase}
              >
                Create Recovery Phrase
              </SecondaryButton>
            ) : null}

            {canLinkPasskey ? (
              <SecondaryButton type="button" disabled={manageDisabled} onClick={onLinkPasskey}>
                Link Passkey
              </SecondaryButton>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="border-t border-slate-100 pt-6">
        <Overview />
      </div>
    </div>
  );
}

export function Encryption() {
  const {
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
  } = useVault();

  if (!user || !me) {
    return null;
  }

  if (!vaultInitialized) {
    return <EncryptionUninitializedView />;
  }

  return (
    <>
      <Card title="Encryption" description={ENCRYPTION_DESCRIPTION}>
        <VaultSlotsPanel
          vaultUnlocked={vaultUnlocked}
          manageDisabled={manageDisabled}
          passkeysLoading={passkeysLoading}
          multifactorEnabled={user.multifactorEnabled === true}
          passkeys={passkeys}
          prfSlots={prfSlots}
          slots={slots}
          recoveryIndexById={recoveryIndexById}
          showRemove={showRemove}
          canAddPasswordSlot={canAddPasswordSlot}
          canAddRecoveryPhrase={canAddRecoveryPhrase}
          canLinkPasskey={canLinkPasskey}
          onUnlockClick={() => {
            setVaultModalErrors([]);
            setVaultModalOpen(true);
          }}
          onRemoveSlot={(slot) => {
            setRemoveErrors([]);
            setRemoveSlot(slot);
          }}
          onAddPasswordSlot={() => {
            setPasswordSlotErrors([]);
            setPasswordSlotOpen(true);
          }}
          onAddRecoveryPhrase={() => {
            setRecoveryErrors([]);
            setRecoveryOpen(true);
          }}
          onLinkPasskey={() => {
            setPasskeyErrors([]);
            setPasskeyOpen(true);
          }}
        />
      </Card>

      <VaultPasswordModal
        isOpen={vaultModalOpen}
        mode="unlock"
        submitting={vaultModalBusy}
        errorMessages={vaultModalErrors}
        onClose={() => {
          if (!vaultModalBusy) {
            setVaultModalOpen(false);
          }
        }}
        onConfirm={(password) => {
          void handleVaultUnlock(password);
        }}
      />

      <RemoveVaultSlotModal
        isOpen={removeSlot !== null}
        slot={removeSlot}
        slotLabel={removeSlotLabel}
        submitting={removeBusy}
        errorMessages={removeErrors}
        onClose={() => {
          if (!removeBusy) {
            setRemoveSlot(null);
          }
        }}
        onConfirm={(password) => {
          void handleRemoveConfirm(password);
        }}
      />

      <AddRecoveryPhraseModal
        isOpen={recoveryOpen}
        submitting={recoveryBusy}
        errorMessages={recoveryErrors}
        onClose={() => {
          if (!recoveryBusy) {
            setRecoveryOpen(false);
          }
        }}
        onConfirm={(phrase, label, password) => {
          void handleRecoveryConfirm(phrase, label, password);
        }}
      />

      <AddPasskeyVaultModal
        isOpen={passkeyOpen}
        passkeys={eligiblePasskeys}
        submitting={passkeyBusy}
        errorMessages={passkeyErrors}
        onClose={() => {
          if (!passkeyBusy) {
            setPasskeyOpen(false);
          }
        }}
        onConfirm={(passkey, label, password) => {
          void handlePasskeyConfirm(passkey, label, password);
        }}
      />

      <AddPasswordSlotModal
        isOpen={passwordSlotOpen}
        submitting={passwordSlotBusy}
        errorMessages={passwordSlotErrors}
        onClose={() => {
          if (!passwordSlotBusy) {
            setPasswordSlotOpen(false);
          }
        }}
        onConfirm={(password) => {
          void handlePasswordSlotConfirm(password);
        }}
      />
    </>
  );
}
