import { BrandLogo } from "@web/components/brand/BrandLogo";
import { useAuth } from "@web/context/Auth/AuthContext";
import { useSettings } from "@web/context/Settings/SettingsContext";
import { path, routes } from "@web/router/routes";
import type { RouteConfig } from "@web/router/types";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FaChevronDown } from "react-icons/fa";
import { LuChevronsLeft, LuChevronsRight, LuEllipsisVertical } from "react-icons/lu";
import { NavLink, useLocation, useNavigate } from "react-router-dom";

const SIDEBAR_COLLAPSED_KEY = "networth.sidebar.collapsed";
const FLYOUT_CLOSE_DELAY_MS = 100;

const navRoutes = routes.filter((route) => route.sidebar?.show === true);

type NavGroup = {
  label: string;
  icon: React.ReactNode;
  routes: RouteConfig[];
};

function buildNavItems(): Array<RouteConfig | NavGroup> {
  const items: Array<RouteConfig | NavGroup> = [];
  const groups = new Map<string, NavGroup>();

  for (const route of navRoutes) {
    const group = route.sidebar?.group;
    if (!group) {
      items.push(route);
      continue;
    }

    let entry = groups.get(group);
    if (!entry) {
      entry = {
        label: group,
        icon: route.sidebar?.groupIcon,
        routes: [],
      };
      groups.set(group, entry);
      items.push(entry);
    }
    entry.routes.push(route);
  }

  return items;
}

const navItems = buildNavItems();

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

function subNavClass(isActive: boolean) {
  return isActive
    ? "flex items-center gap-3 rounded-sm py-2 pl-3 pr-3 text-sm font-medium transition bg-blue-50 text-blue-700"
    : "flex items-center gap-3 rounded-sm py-2 pl-3 pr-3 text-sm font-medium transition text-slate-500 hover:bg-slate-100 hover:text-slate-900";
}

function useFlyoutHover() {
  const [open, setOpen] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current !== null) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  function openFlyout() {
    clearCloseTimer();
    setOpen(true);
  }

  function scheduleCloseFlyout() {
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => {
      setOpen(false);
    }, FLYOUT_CLOSE_DELAY_MS);
  }

  useEffect(() => {
    return () => {
      clearCloseTimer();
    };
  }, [clearCloseTimer]);

  return { open, openFlyout, scheduleCloseFlyout, setOpen };
}

function NavGroupFlyout({ group }: { group: NavGroup }) {
  const location = useLocation();
  const flyoutId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [flyoutPosition, setFlyoutPosition] = useState({ top: 0, left: 0 });
  const { open, openFlyout, scheduleCloseFlyout, setOpen } = useFlyoutHover();
  const isGroupActive = group.routes.some((route) => location.pathname.startsWith(route.path));

  const updateFlyoutPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) {
      return;
    }

    const rect = trigger.getBoundingClientRect();
    setFlyoutPosition({
      top: rect.top,
      left: rect.left + rect.width + 4,
    });
  }, []);

  function handleOpenFlyout() {
    updateFlyoutPosition();
    openFlyout();
  }

  useEffect(() => {
    if (!open) {
      return;
    }

    updateFlyoutPosition();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    function handleLayoutChange() {
      updateFlyoutPosition();
    }

    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleLayoutChange);
    window.addEventListener("scroll", handleLayoutChange, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleLayoutChange);
      window.removeEventListener("scroll", handleLayoutChange, true);
    };
  }, [open, setOpen, updateFlyoutPosition]);

  const flyoutPanel =
    open && typeof document !== "undefined"
      ? createPortal(
          <div
            id={flyoutId}
            role="menu"
            aria-label={group.label}
            style={{
              top: flyoutPosition.top,
              left: flyoutPosition.left,
            }}
            className="fixed z-50 min-w-44 rounded-sm border border-slate-200 bg-white py-1 shadow-lg"
            onMouseEnter={openFlyout}
            onMouseLeave={scheduleCloseFlyout}
          >
            {group.routes.map((route) => (
              <NavLink
                key={route.path}
                to={route.path}
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                }}
                className={({ isActive }) => subNavClass(isActive)}
              >
                <span className="text-base" aria-hidden>
                  {route.sidebar?.icon}
                </span>
                {route.label}
              </NavLink>
            ))}
          </div>,
          document.body
        )
      : null;

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label={group.label}
        aria-expanded={open}
        aria-controls={open ? flyoutId : undefined}
        aria-haspopup="menu"
        onFocus={handleOpenFlyout}
        onBlur={scheduleCloseFlyout}
        onMouseEnter={handleOpenFlyout}
        onMouseLeave={scheduleCloseFlyout}
        className={[
          "flex w-full items-center justify-center rounded-sm p-2 text-lg transition",
          isGroupActive
            ? "bg-blue-50 text-blue-700"
            : "text-slate-500 hover:bg-slate-100 hover:text-slate-900",
        ].join(" ")}
      >
        <span aria-hidden>{group.icon}</span>
      </button>
      {flyoutPanel}
    </div>
  );
}

function NavGroupSection({ group, collapsed }: { group: NavGroup; collapsed: boolean }) {
  const location = useLocation();
  const submenuId = useId();
  const isGroupActive = group.routes.some((route) => location.pathname.startsWith(route.path));
  const [isExpanded, setIsExpanded] = useState(isGroupActive);

  useEffect(() => {
    if (isGroupActive) {
      setIsExpanded(true);
    }
  }, [isGroupActive]);

  if (collapsed) {
    return <NavGroupFlyout group={group} />;
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        aria-expanded={isExpanded}
        aria-controls={submenuId}
        onClick={() => {
          setIsExpanded((current) => !current);
        }}
        className={[
          "flex w-full items-center gap-3 rounded-sm px-3 py-2 text-left text-sm font-medium transition",
          isGroupActive
            ? "bg-blue-50 text-blue-700"
            : "text-slate-500 hover:bg-slate-100 hover:text-slate-900",
        ].join(" ")}
      >
        <span className="text-lg" aria-hidden>
          {group.icon}
        </span>
        <span className="min-w-0 flex-1 truncate">{group.label}</span>
        <FaChevronDown
          className={["size-3 shrink-0 transition-transform", isExpanded ? "rotate-180" : ""].join(
            " "
          )}
          aria-hidden
        />
      </button>
      {isExpanded ? (
        <div id={submenuId} className="flex flex-col gap-1">
          {group.routes.map((route) => (
            <NavLink
              key={route.path}
              to={route.path}
              className={({ isActive }) =>
                isActive
                  ? "flex items-center gap-3 rounded-sm py-2 pl-9 pr-3 text-sm font-medium transition bg-blue-50 text-blue-700"
                  : "flex items-center gap-3 rounded-sm py-2 pl-9 pr-3 text-sm font-medium transition text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              }
            >
              <span className="text-base" aria-hidden>
                {route.sidebar?.icon}
              </span>
              {route.label}
            </NavLink>
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
      aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
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
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div>
      <div
        className={[
          "flex items-center gap-2",
          collapsed ? "justify-center px-0" : "justify-between px-1",
        ].join(" ")}
      >
        {collapsed ? null : (
          <p className="truncate text-sm font-medium text-slate-700">{displayName}</p>
        )}
        <div ref={containerRef} className="relative shrink-0">
          <button
            type="button"
            aria-label="Account menu"
            aria-expanded={open}
            aria-haspopup="menu"
            aria-controls={open ? menuId : undefined}
            title={collapsed ? displayName : undefined}
            onClick={() => {
              setOpen((current) => !current);
            }}
            className="flex size-7 items-center justify-center rounded-sm text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <LuEllipsisVertical className="size-4" strokeWidth={1.5} aria-hidden />
          </button>
          {open ? (
            <div
              id={menuId}
              role="menu"
              aria-label="Account menu"
              className={[
                "absolute z-10 min-w-36 rounded-sm border border-slate-200 bg-white py-1 shadow-lg",
                collapsed ? "bottom-full left-0 mb-1" : "bottom-full right-0 mb-1",
              ].join(" ")}
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
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
                  setOpen(false);
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
        "flex h-screen shrink-0 flex-col border-r border-slate-200 bg-white transition-[width] duration-200",
        collapsed ? "w-16" : "w-56",
      ].join(" ")}
    >
      <div
        className={[
          "shrink-0 border-b border-slate-200",
          collapsed ? "flex flex-col items-center gap-2 p-2" : "flex items-center gap-3 px-4 py-3",
        ].join(" ")}
      >
        <BrandLogo
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
        {navItems.map((item) =>
          "routes" in item ? (
            <NavGroupSection key={item.label} group={item} collapsed={collapsed} />
          ) : (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/"}
              title={collapsed ? item.label : undefined}
              aria-label={collapsed ? item.label : undefined}
              className={({ isActive }) => topLevelNavClass(isActive, collapsed)}
            >
              <span className="text-lg" aria-hidden>
                {item.sidebar?.icon}
              </span>
              {collapsed ? null : item.label}
            </NavLink>
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
