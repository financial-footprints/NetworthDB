import { useAuth } from "@web/context/Auth/AuthContext";
import { useSettings } from "@web/context/Settings/SettingsContext";
import {
  resolveSettingsSection,
  SettingsNav,
  type SettingsSection,
} from "@web/context/Settings/SettingsNav";
import { BackupRestoreSettings } from "@web/context/Settings/sections/BackupRestoreSettings";
import { ProfileSettings } from "@web/context/Settings/sections/ProfileSettings";
import { UserSettings } from "@web/context/Settings/sections/UserSettings";
import { OVERLAY_Z } from "@web/utils/constant";
import { useEffect, useId, useState } from "react";
import { LuX } from "react-icons/lu";

export function SettingsModal() {
  const titleId = useId();
  const { isOpen, closeSettings } = useSettings();
  const { user } = useAuth();
  const [activeSection, setActiveSection] = useState<SettingsSection>("profile");

  useEffect(() => {
    if (isOpen) {
      setActiveSection("profile");
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeSettings();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, closeSettings]);

  if (!isOpen || !user) {
    return null;
  }

  const resolvedSection = resolveSettingsSection(activeSection, user.role);

  return (
    <div className={`fixed inset-0 ${OVERLAY_Z} flex items-center justify-center p-4`}>
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/50"
        aria-label="Close settings"
        onClick={closeSettings}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex h-[min(85vh,900px)] w-full max-w-6xl flex-col overflow-hidden rounded-sm bg-white shadow-xl"
      >
        <header className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 id={titleId} className="text-base font-semibold text-slate-900 sm:text-lg">
            Settings
          </h2>
          <button
            type="button"
            onClick={closeSettings}
            className="flex size-9 shrink-0 items-center justify-center rounded-sm text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
            aria-label="Close"
          >
            <LuX className="size-4" strokeWidth={1.5} aria-hidden />
          </button>
        </header>
        <div className="flex min-h-0 flex-1">
          <SettingsNav
            activeSection={resolvedSection}
            onSelect={setActiveSection}
            role={user.role}
          />
          <div className="min-w-0 flex-1 overflow-y-auto p-6">
            {resolvedSection === "profile" ? (
              <ProfileSettings />
            ) : resolvedSection === "backup" ? (
              <BackupRestoreSettings />
            ) : (
              <UserSettings />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
