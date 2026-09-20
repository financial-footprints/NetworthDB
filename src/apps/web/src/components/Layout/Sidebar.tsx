import { Logo } from "@web/components/Brand/Logo";
import { ActivePeriodPicker } from "@web/components/Layout/ActivePeriodPicker";
import { useActivePeriod } from "@web/contexts/ActivePeriod/Context";
import { useAuth } from "@web/contexts/Auth/Context";
import { useSettings } from "@web/contexts/Settings/Context";
import { path, routes } from "@web/router/routes";
import { buildSidebarNavEntries, sidebarGroupMatchesPath } from "@web/router/sidebar-nav";
import type { RouteConfig } from "@web/router/types";
import { activePeriodRangeLabel } from "@web/utils/active-period";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import {
  LuCalendarRange,
  LuChevronDown,
  LuChevronRight,
  LuChevronsLeft,
  LuChevronsRight,
  LuEllipsisVertical,
} from "react-icons/lu";
import { NavLink, useLocation, useNavigate } from "react-router-dom";

const SIDEBAR_COLLAPSED_KEY = "networth.sidebar.collapsed";

const navRoutes = routes.filter((route) => route.sidebar?.show === true);
const sidebarNavEntries = buildSidebarNavEntries(navRoutes);

function readSidebarCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true";
  } catch {
    return false;
  }
}

function writeSidebarCollapsed(collapsed: boolean) {
  try {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));
  } catch {
    // Ignore storage failures (private browsing, quota, etc.)
  }
}

function topLevelNavClass(isActive: boolean, collapsed: boolean) {
  const base = collapsed
    ? "flex items-center justify-center rounded-sm p-2 text-sm font-medium transition"
    : "flex items-center gap-3 rounded-sm px-3 py-2 text-sm font-medium transition";

  return isActive
    ? `${base} bg-blue-50 text-blue-700`
    : `${base} text-slate-500 hover:bg-slate-100 hover:text-slate-900`;
}

function nestedNavClass(isActive: boolean) {
  const base = "flex items-center gap-3 rounded-sm py-2 pl-9 pr-3 text-sm font-medium transition";
  return isActive
    ? `${base} bg-blue-50 text-blue-700`
    : `${base} text-slate-500 hover:bg-slate-100 hover:text-slate-900`;
}

function groupHeaderClass(isChildActive: boolean) {
  const base = "flex w-full items-center gap-3 rounded-sm px-3 py-2 text-sm font-medium transition";
  return isChildActive
    ? `${base} text-blue-700`
    : `${base} text-slate-500 hover:bg-slate-100 hover:text-slate-900`;
}

function SidebarNavRoute({
  route,
  collapsed,
  className,
}: {
  route: RouteConfig;
  collapsed: boolean;
  className: (isActive: boolean) => string;
}) {
  return (
    <NavLink
      to={route.path}
      end={route.path === "/"}
      title={collapsed ? route.label : undefined}
      aria-label={collapsed ? route.label : undefined}
      className={({ isActive }) => className(isActive)}
    >
      <span className="text-lg" aria-hidden>
        {route.sidebar?.icon}
      </span>
      {collapsed ? null : route.label}
    </NavLink>
  );
}

function SidebarNavGroup({
  label,
  icon,
  routes: groupRoutes,
  collapsed,
}: {
  label: string;
  icon: ReactNode;
  routes: RouteConfig[];
  collapsed: boolean;
}) {
  const { pathname } = useLocation();
  const childActive = sidebarGroupMatchesPath(groupRoutes, pathname);
  const [expanded, setExpanded] = useState(() => childActive);

  useEffect(() => {
    if (childActive) {
      setExpanded(true);
    }
  }, [childActive]);

  if (collapsed) {
    return (
      <>
        {groupRoutes.map((route) => (
          <SidebarNavRoute
            key={route.path}
            route={route}
            collapsed={collapsed}
            className={(isActive) => topLevelNavClass(isActive, collapsed)}
          />
        ))}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((current) => !current)}
        className={groupHeaderClass(childActive)}
      >
        <span className="text-lg" aria-hidden>
          {icon}
        </span>
        <span className="min-w-0 flex-1 truncate text-left">{label}</span>
        {expanded ? (
          <LuChevronDown className="size-4 shrink-0 text-slate-400" strokeWidth={1.5} aria-hidden />
        ) : (
          <LuChevronRight
            className="size-4 shrink-0 text-slate-400"
            strokeWidth={1.5}
            aria-hidden
          />
        )}
      </button>
      {expanded ? (
        <div className="flex flex-col gap-1">
          {groupRoutes.map((route) => (
            <SidebarNavRoute
              key={route.path}
              route={route}
              collapsed={collapsed}
              className={(isActive) => nestedNavClass(isActive)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SidebarToggleButton({
  collapsed,
  onToggle,
  className,
}: {
  collapsed: boolean;
  onToggle: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={collapsed ? "Expand Sidebar" : "Collapse Sidebar"}
      className={[
        "flex size-8 shrink-0 items-center justify-center rounded-sm text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600",
        className ?? "",
      ].join(" ")}
    >
      {collapsed ? (
        <LuChevronsRight className="size-4" strokeWidth={1.5} aria-hidden />
      ) : (
        <LuChevronsLeft className="size-4" strokeWidth={1.5} aria-hidden />
      )}
    </button>
  );
}

function SidebarUserMenu({
  displayName,
  collapsed,
  onLogout,
  onOpenSettings,
}: {
  displayName: string;
  collapsed: boolean;
  onLogout: () => Promise<void>;
  onOpenSettings: () => void;
}) {
  const { label, unbounded, from, to } = useActivePeriod();
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [periodPickerOpen, setPeriodPickerOpen] = useState(false);
  const footerRef = useRef<HTMLDivElement>(null);
  const periodAnchorRef = useRef<HTMLDivElement>(null);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const accountMenuId = useId();
  const sidebarRangeLabel = unbounded ? "" : activePeriodRangeLabel(from, to, { compact: true });
  const periodCaption = unbounded || !sidebarRangeLabel ? label : `${label} · ${sidebarRangeLabel}`;

  useEffect(() => {
    if (!accountMenuOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target as Node)) {
        setAccountMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setAccountMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [accountMenuOpen]);

  return (
    <div ref={footerRef} className="relative">
      {collapsed ? (
        <div className="flex flex-col items-center gap-2">
          <div ref={periodAnchorRef} className="relative">
            <button
              type="button"
              aria-label="Active Period"
              aria-expanded={periodPickerOpen}
              title={periodCaption}
              onClick={() => {
                setAccountMenuOpen(false);
                setPeriodPickerOpen((current) => !current);
              }}
              className="flex size-7 items-center justify-center rounded-sm text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            >
              <LuCalendarRange className="size-4" strokeWidth={1.5} aria-hidden />
            </button>
            <ActivePeriodPicker
              open={periodPickerOpen}
              onClose={() => setPeriodPickerOpen(false)}
              anchorRef={periodAnchorRef}
              collapsed={collapsed}
            />
          </div>
          <div ref={accountMenuRef} className="relative">
            <button
              type="button"
              aria-label="Account Menu"
              aria-expanded={accountMenuOpen}
              aria-haspopup="menu"
              aria-controls={accountMenuOpen ? accountMenuId : undefined}
              title={displayName}
              onClick={() => {
                setPeriodPickerOpen(false);
                setAccountMenuOpen((current) => !current);
              }}
              className="flex size-7 items-center justify-center rounded-sm text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            >
              <LuEllipsisVertical className="size-4" strokeWidth={1.5} aria-hidden />
            </button>
            {accountMenuOpen ? (
              <div
                id={accountMenuId}
                role="menu"
                aria-label="Account Menu"
                className="absolute bottom-full left-0 z-10 mb-1 min-w-36 rounded-sm border border-slate-200 bg-white py-1 shadow-lg"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setAccountMenuOpen(false);
                    onOpenSettings();
                  }}
                  className="flex w-full px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-blue-50 hover:text-blue-600"
                >
                  Settings
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setAccountMenuOpen(false);
                    void onLogout();
                  }}
                  className="flex w-full px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-red-50 hover:text-red-600"
                >
                  Logout
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 justify-between px-1">
          <p className="truncate text-sm font-medium text-slate-700">{displayName}</p>
          <div className="flex shrink-0 items-center gap-0.5">
            <div ref={periodAnchorRef} className="relative">
              <button
                type="button"
                aria-label="Active Period"
                aria-expanded={periodPickerOpen}
                title={periodCaption}
                onClick={() => {
                  setAccountMenuOpen(false);
                  setPeriodPickerOpen((current) => !current);
                }}
                className="flex size-7 items-center justify-center rounded-sm text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              >
                <LuCalendarRange className="size-4" strokeWidth={1.5} aria-hidden />
              </button>
              <ActivePeriodPicker
                open={periodPickerOpen}
                onClose={() => setPeriodPickerOpen(false)}
                anchorRef={periodAnchorRef}
                collapsed={collapsed}
              />
            </div>
            <div ref={accountMenuRef} className="relative">
              <button
                type="button"
                aria-label="Account Menu"
                aria-expanded={accountMenuOpen}
                aria-haspopup="menu"
                aria-controls={accountMenuOpen ? accountMenuId : undefined}
                onClick={() => {
                  setPeriodPickerOpen(false);
                  setAccountMenuOpen((current) => !current);
                }}
                className="flex size-7 items-center justify-center rounded-sm text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              >
                <LuEllipsisVertical className="size-4" strokeWidth={1.5} aria-hidden />
              </button>
              {accountMenuOpen ? (
                <div
                  id={accountMenuId}
                  role="menu"
                  aria-label="Account Menu"
                  className="absolute bottom-full right-0 z-10 mb-1 min-w-36 rounded-sm border border-slate-200 bg-white py-1 shadow-lg"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setAccountMenuOpen(false);
                      onOpenSettings();
                    }}
                    className="flex w-full px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-blue-50 hover:text-blue-600"
                  >
                    Settings
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setAccountMenuOpen(false);
                      void onLogout();
                    }}
                    className="flex w-full px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-red-50 hover:text-red-600"
                  >
                    Logout
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function Sidebar() {
  const { user, logout } = useAuth();
  const { openSettings } = useSettings();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(readSidebarCollapsed);

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current;
      writeSidebarCollapsed(next);
      return next;
    });
  }

  async function handleLogout() {
    await logout();
    navigate(path.login, { replace: true });
  }

  return (
    <aside
      className={[
        "relative flex h-screen shrink-0 flex-col border-r border-slate-200 bg-white transition-[width] duration-200",
        collapsed ? "w-16" : "w-56",
      ].join(" ")}
    >
      <div
        className={[
          "shrink-0 border-b border-slate-200",
          collapsed ? "flex flex-col items-center gap-2 p-2" : "flex items-center gap-3 px-4 py-3",
        ].join(" ")}
      >
        <Logo
          variant={collapsed ? "mark" : "icon"}
          className={collapsed ? "h-11 w-11 shrink-0 object-contain" : undefined}
        />
        {collapsed ? null : (
          <div className="min-w-0 flex-1 leading-none">
            <p className="text-base font-semibold text-slate-900">NetworthDB</p>
            <p className="mt-1 text-[11px] text-slate-500">Networth Insights</p>
          </div>
        )}
        <SidebarToggleButton
          collapsed={collapsed}
          onToggle={toggleCollapsed}
          className={collapsed ? undefined : "shrink-0"}
        />
      </div>
      <nav
        className={[
          "flex min-h-0 flex-1 flex-col gap-1",
          collapsed ? "overflow-visible p-2" : "overflow-y-auto p-4",
        ].join(" ")}
      >
        {sidebarNavEntries.map((entry) =>
          entry.kind === "route" ? (
            <SidebarNavRoute
              key={entry.route.path}
              route={entry.route}
              collapsed={collapsed}
              className={(isActive) => topLevelNavClass(isActive, collapsed)}
            />
          ) : (
            <SidebarNavGroup
              key={entry.id}
              label={entry.label}
              icon={entry.icon}
              routes={entry.routes}
              collapsed={collapsed}
            />
          )
        )}
      </nav>
      {user ? (
        <div
          className={["shrink-0 border-t border-slate-200", collapsed ? "p-2" : "p-4"].join(" ")}
        >
          <SidebarUserMenu
            displayName={user.displayName ?? user.username}
            collapsed={collapsed}
            onLogout={handleLogout}
            onOpenSettings={openSettings}
          />
        </div>
      ) : null}
    </aside>
  );
}
