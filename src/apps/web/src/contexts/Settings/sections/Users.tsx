import completedTasksIllustration from "@web/assets/images/illustrations/completed-tasks.svg";
import { mapDeleteUserError } from "@web/components/Auth/helpers";
import { Status } from "@web/components/Badge/Status";
import {
  ConfirmDeleteButton,
  IconActionButton,
  PrimaryButton,
  SecondaryButton,
} from "@web/components/Button";
import { StatusView } from "@web/components/Layout/StatusView";
import { Controls } from "@web/components/Pagination/Controls";
import { useAuth } from "@web/contexts/Auth/Context";
import { useNotifications } from "@web/contexts/Notifications/Context";
import { CreateUserModal } from "@web/contexts/Settings/modals/admin/CreateUserModal";
import { useList } from "@web/hooks/list";
import { deleteUser, listUsers } from "@web/utils/api/routes/auth";
import {
  canCreateUsers,
  canDeleteUsers,
  type ListedUser,
  type MfaFilter,
  type RoleFilter,
} from "@web/utils/api/routes/auth/types";
import { DEFAULT_LIST_PAGE_SIZE } from "@web/utils/constants";
import { formatTimestamp } from "@web/utils/time";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { LuListFilter, LuX } from "react-icons/lu";

const SEARCH_DEBOUNCE_MS = 300;

type UserListFilters = {
  mfaFilter: MfaFilter;
  roleFilter: RoleFilter;
  usernameSearch: string;
};

const ROLE_OPTIONS: { value: RoleFilter; label: string }[] = [
  { value: "all", label: "All Roles" },
  { value: "user", label: "User" },
  { value: "manager", label: "Manager" },
  { value: "administrator", label: "Administrator" },
];

const MFA_OPTIONS: { value: MfaFilter; label: string }[] = [
  { value: "all", label: "All Users" },
  { value: "enabled", label: "MFA Enabled" },
  { value: "disabled", label: "MFA Disabled" },
];

function mfaEnabledForFilter(filter: MfaFilter): boolean | undefined {
  if (filter === "enabled") {
    return true;
  }
  if (filter === "disabled") {
    return false;
  }
  return undefined;
}

function roleLabel(role: RoleFilter): string {
  return ROLE_OPTIONS.find((option) => option.value === role)?.label ?? role;
}

function mfaLabel(filter: MfaFilter): string {
  return MFA_OPTIONS.find((option) => option.value === filter)?.label ?? filter;
}

function FilterPill({ label, onDismiss }: { label: string; onDismiss: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 py-1 pl-2.5 pr-1 text-xs font-medium text-slate-700 ring-1 ring-inset ring-slate-200">
      {label}
      <button
        type="button"
        onClick={onDismiss}
        className="flex size-5 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-200 hover:text-slate-800"
        aria-label={`Remove ${label} filter`}
      >
        <LuX className="size-3" strokeWidth={2} aria-hidden />
      </button>
    </span>
  );
}

function FilterOptionGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const selected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              aria-pressed={selected}
              className={[
                "rounded-full px-2.5 py-1 text-xs font-medium transition",
                selected
                  ? "bg-[#1a5fb4] text-white shadow-sm"
                  : "bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200 hover:bg-slate-200",
              ].join(" ")}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function UserListFilterPopover({
  mfaFilter,
  roleFilter,
  onMfaFilterChange,
  onRoleFilterChange,
  hasActiveFilters,
}: {
  mfaFilter: MfaFilter;
  roleFilter: RoleFilter;
  onMfaFilterChange: (value: MfaFilter) => void;
  onRoleFilterChange: (value: RoleFilter) => void;
  hasActiveFilters: boolean;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const popoverId = useId();

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
    <div ref={containerRef} className="relative shrink-0">
      <IconActionButton
        onClick={() => {
          setOpen((current) => !current);
        }}
        title="Filter users"
        tone={hasActiveFilters ? "edit" : "neutral"}
      >
        <LuListFilter className="size-4" strokeWidth={1.75} aria-hidden />
      </IconActionButton>

      {open ? (
        <div
          id={popoverId}
          role="dialog"
          aria-label="Filter Users"
          className="absolute top-full right-0 z-10 mt-2 w-72 rounded-sm border border-slate-200 bg-white p-4 shadow-lg"
        >
          <div className="space-y-4">
            <FilterOptionGroup
              label="MFA"
              options={MFA_OPTIONS}
              value={mfaFilter}
              onChange={onMfaFilterChange}
            />
            <FilterOptionGroup
              label="Role"
              options={ROLE_OPTIONS}
              value={roleFilter}
              onChange={onRoleFilterChange}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function UsersTable({
  users,
  canDelete,
  currentUserId,
  onDeleted,
}: {
  users: ListedUser[];
  canDelete: boolean;
  currentUserId: string | null;
  onDeleted: () => void;
}) {
  const { pushNotification } = useNotifications();

  async function handleDeleteUser(user: ListedUser): Promise<void> {
    try {
      await deleteUser(user.id);
    } catch (error) {
      throw new Error(mapDeleteUserError(error));
    }
  }

  return (
    <div className="overflow-x-auto rounded-sm border border-slate-200">
      <table className="w-full text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">Username</th>
            <th className="px-4 py-3">Role</th>
            <th className="px-4 py-3">MFA</th>
            <th className="px-4 py-3">Created</th>
            {canDelete ? <th className="px-4 py-3 text-right">Actions</th> : null}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 text-slate-700">
          {users.map((user) => (
            <tr key={user.id} className="bg-white">
              <td className="px-4 py-3 font-medium text-slate-900">{user.username}</td>
              <td className="px-4 py-3">{user.role}</td>
              <td className="px-4 py-3">
                <Status
                  label={user.multifactorEnabled ? "Enabled" : "Disabled"}
                  className={
                    user.multifactorEnabled
                      ? "bg-green-50 text-green-800 ring-green-200"
                      : "bg-slate-50 text-slate-700 ring-slate-200"
                  }
                />
              </td>
              <td className="px-4 py-3 text-slate-600">{formatTimestamp(user.createdAt)}</td>
              {canDelete ? (
                <td className="px-4 py-3">
                  {user.id !== currentUserId ? (
                    <div className="flex justify-end">
                      <ConfirmDeleteButton
                        variant="icon"
                        confirmMessage={`Delete user ${user.username}? This cannot be undone.`}
                        onDelete={() => handleDeleteUser(user)}
                        onSuccess={() => {
                          pushNotification("User deleted", "success");
                          onDeleted();
                        }}
                        errorMessage="Could not delete user."
                        title="Delete user"
                        loadingLabel="Deleting…"
                      />
                    </div>
                  ) : null}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type UserListBodyProps = {
  loading: boolean;
  error: string | null;
  items: ListedUser[];
  canDelete: boolean;
  currentUserId: string | null;
  pagination: ReturnType<typeof useList<ListedUser, UserListFilters>>["pagination"];
  onRefresh: () => void;
};

function UserListBody({
  loading,
  error,
  items,
  canDelete,
  currentUserId,
  pagination,
  onRefresh,
}: UserListBodyProps) {
  if (loading && items.length === 0) {
    return (
      <output className="block text-sm text-slate-500" aria-busy="true">
        Loading users…
      </output>
    );
  }

  if (error) {
    return (
      <div className="space-y-3 rounded-sm border border-red-200 bg-red-50 p-4">
        <p className="text-sm text-red-800">{error}</p>
        <SecondaryButton onClick={onRefresh}>Try Again</SecondaryButton>
      </div>
    );
  }

  if (!loading && items.length === 0) {
    return (
      <StatusView
        illustration={completedTasksIllustration}
        title="No users found"
        message="Try changing your search or filters."
      />
    );
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <UsersTable
        users={items}
        canDelete={canDelete}
        currentUserId={currentUserId}
        onDeleted={onRefresh}
      />
      <Controls pagination={pagination} />
    </div>
  );
}

export function Users() {
  const { user } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);
  const [usernameInput, setUsernameInput] = useState("");
  const [usernameSearch, setUsernameSearch] = useState("");
  const [mfaFilter, setMfaFilter] = useState<MfaFilter>("all");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");

  const showCreate = user !== null && canCreateUsers(user.role);
  const showDelete = user !== null && canDeleteUsers(user.role);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setUsernameSearch(usernameInput.trim());
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [usernameInput]);

  const filters = useMemo<UserListFilters>(
    () => ({ mfaFilter, roleFilter, usernameSearch }),
    [mfaFilter, roleFilter, usernameSearch]
  );

  const { items, loading, error, pagination, refresh } = useList<ListedUser, UserListFilters>({
    pageSize: DEFAULT_LIST_PAGE_SIZE,
    filters,
    fetchPage: async ({ limit, offset, filters: activeFilters }, signal) => {
      const response = await listUsers({
        pagination: { limit, offset },
        filters: {
          multifactorEnabled: mfaEnabledForFilter(activeFilters.mfaFilter),
          role: activeFilters.roleFilter !== "all" ? activeFilters.roleFilter : undefined,
        },
        search: activeFilters.usernameSearch || undefined,
      });

      if (signal.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }

      return response;
    },
  });

  const hasActiveFilters = mfaFilter !== "all" || roleFilter !== "all";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-slate-900">Users</h3>
          <p className="text-sm text-slate-500">User Management</p>
        </div>
        {showCreate ? (
          <PrimaryButton onClick={() => setCreateOpen(true)}>Create</PrimaryButton>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Search by Username</span>
          <input
            type="search"
            className="form-input"
            placeholder="Search by Username"
            value={usernameInput}
            onChange={(event) => setUsernameInput(event.target.value)}
          />
        </label>
        <UserListFilterPopover
          mfaFilter={mfaFilter}
          roleFilter={roleFilter}
          onMfaFilterChange={setMfaFilter}
          onRoleFilterChange={setRoleFilter}
          hasActiveFilters={hasActiveFilters}
        />
      </div>

      {hasActiveFilters ? (
        <div className="flex flex-wrap items-center gap-2">
          {mfaFilter !== "all" ? (
            <FilterPill label={mfaLabel(mfaFilter)} onDismiss={() => setMfaFilter("all")} />
          ) : null}
          {roleFilter !== "all" ? (
            <FilterPill label={roleLabel(roleFilter)} onDismiss={() => setRoleFilter("all")} />
          ) : null}
        </div>
      ) : null}

      <UserListBody
        loading={loading}
        error={error}
        items={items}
        canDelete={showDelete}
        currentUserId={user?.id ?? null}
        pagination={pagination}
        onRefresh={refresh}
      />

      {showCreate ? (
        <CreateUserModal
          isOpen={createOpen}
          onClose={() => setCreateOpen(false)}
          onCreated={refresh}
        />
      ) : null}
    </div>
  );
}
