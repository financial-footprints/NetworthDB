import { canListUsers } from "@web/utils/api/endpoints/auth/types";
import { useMemo } from "react";
import { LuArchive, LuUser, LuUsers } from "react-icons/lu";

export type SettingsSection = "profile" | "backup" | "users";

type SettingsNavItem = {
  id: SettingsSection;
  label: string;
  icon: React.ReactNode;
};

const profileItem: SettingsNavItem = {
  id: "profile",
  label: "Profile",
  icon: <LuUser className="size-4" strokeWidth={1.5} aria-hidden />,
};

const backupItem: SettingsNavItem = {
  id: "backup",
  label: "Backup & Restore",
  icon: <LuArchive className="size-4" strokeWidth={1.5} aria-hidden />,
};

const usersItem: SettingsNavItem = {
  id: "users",
  label: "Users",
  icon: <LuUsers className="size-4" strokeWidth={1.5} aria-hidden />,
};

const NAV_ITEMS: Record<SettingsSection, SettingsNavItem> = {
  profile: profileItem,
  backup: backupItem,
  users: usersItem,
};

const NAV_SECTION_ORDER: SettingsSection[] = ["profile", "users", "backup"];

function canViewSettingsSection(section: SettingsSection, role: string): boolean {
  switch (section) {
    case "profile":
    case "backup":
      return true;
    case "users":
      return canListUsers(role);
  }
}

function getVisibleSettingsSections(role: string): SettingsSection[] {
  return NAV_SECTION_ORDER.filter((section) => canViewSettingsSection(section, role));
}

export function resolveSettingsSection(section: SettingsSection, role: string): SettingsSection {
  if (canViewSettingsSection(section, role)) {
    return section;
  }
  return getVisibleSettingsSections(role)[0] ?? "profile";
}

type SettingsNavProps = {
  activeSection: SettingsSection;
  onSelect: (section: SettingsSection) => void;
  role: string;
};

export function SettingsNav({ activeSection, onSelect, role }: SettingsNavProps) {
  const items = useMemo(
    () => getVisibleSettingsSections(role).map((section) => NAV_ITEMS[section]),
    [role]
  );

  return (
    <nav
      className="flex w-52 shrink-0 flex-col gap-1 border-r border-slate-200 p-4"
      aria-label="Settings sections"
    >
      {items.map((item) => {
        const isActive = activeSection === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              onSelect(item.id);
            }}
            className={
              isActive
                ? "flex w-full items-center gap-3 rounded-sm px-3 py-2 text-left text-sm font-medium transition bg-blue-50 text-blue-700"
                : "flex w-full items-center gap-3 rounded-sm px-3 py-2 text-left text-sm font-medium transition text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            }
            aria-current={isActive ? "page" : undefined}
          >
            {item.icon}
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}
