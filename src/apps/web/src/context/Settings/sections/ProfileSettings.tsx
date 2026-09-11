import { useAuth } from "@web/context/Auth/AuthContext";
import { useNotifications } from "@web/context/Notifications/NotificationContext";
import { useSettings } from "@web/context/Settings/SettingsContext";
import { ProfileDetailsSection } from "@web/context/Settings/sections/profile/ProfileDetailsSection";
import { ProfileEncryptionSection } from "@web/context/Settings/sections/profile/ProfileEncryptionSection";
import { ProfileSecuritySection } from "@web/context/Settings/sections/profile/ProfileSecuritySection";
import { ProfileSourcesSection } from "@web/context/Settings/sections/profile/ProfileSourcesSection";
import { path } from "@web/router/routes";
import type { TokenPair } from "@web/utils/api/endpoints/auth/types";
import { errorMessage } from "@web/utils/errors";
import { useCallback } from "react";
import { useNavigate } from "react-router-dom";

export function ProfileSettings() {
  const { logout, establishAuth, reconcileVault } = useAuth();
  const { closeSettings } = useSettings();
  const { pushNotification } = useNotifications();
  const navigate = useNavigate();

  const handleMfaEnrollmentComplete = useCallback(
    async (tokens: TokenPair | null) => {
      if (tokens) {
        try {
          const nextMe = await establishAuth(tokens);
          await reconcileVault(nextMe, {});
          pushNotification("Multi-factor authentication is enabled.", "success");
        } catch (error) {
          pushNotification(
            errorMessage(
              error,
              "MFA was enabled, but the session could not be refreshed. Sign in again."
            ),
            "error"
          );
          closeSettings();
          await logout();
          navigate(path.login, { replace: true });
        }
        return;
      }
      closeSettings();
      await logout();
      navigate(path.login, { state: { mfaEnrolled: true }, replace: true });
    },
    [closeSettings, establishAuth, logout, navigate, pushNotification, reconcileVault]
  );

  const handleMfaRemovalComplete = useCallback(async () => {
    closeSettings();
    await logout();
    navigate(path.login, { state: { mfaEnrolled: true }, replace: true });
  }, [closeSettings, logout, navigate]);

  const handleRecoveryCodesGenerated = useCallback(async () => {
    closeSettings();
    await logout();
    navigate(path.login, {
      state: { recoveryCodesGenerated: true },
      replace: true,
    });
  }, [closeSettings, logout, navigate]);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold text-slate-900">Profile</h3>
        <p className="text-sm text-slate-500">Update profile and security settings</p>
      </div>

      <ProfileDetailsSection />

      <ProfileSourcesSection />

      <ProfileSecuritySection
        onMfaEnrollmentComplete={(tokens) => {
          void handleMfaEnrollmentComplete(tokens);
        }}
        onMfaRemovalComplete={() => {
          void handleMfaRemovalComplete();
        }}
        onRecoveryCodesGenerated={() => {
          void handleRecoveryCodesGenerated();
        }}
      />

      <ProfileEncryptionSection />
    </div>
  );
}
