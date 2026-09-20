import type { RouteConfig } from "@web/router/types";
import type { ReactNode } from "react";

export type SidebarNavEntry =
  | { kind: "route"; route: RouteConfig }
  | {
      kind: "group";
      id: string;
      label: string;
      icon: ReactNode;
      routes: RouteConfig[];
    };

export function buildSidebarNavEntries(navRoutes: RouteConfig[]): SidebarNavEntry[] {
  const entries: SidebarNavEntry[] = [];
  const groupIndexById = new Map<string, number>();

  for (const route of navRoutes) {
    const group = route.sidebar?.group;
    if (!group) {
      entries.push({ kind: "route", route });
      continue;
    }

    const existingIndex = groupIndexById.get(group.id);
    if (existingIndex === undefined) {
      groupIndexById.set(group.id, entries.length);
      entries.push({
        kind: "group",
        id: group.id,
        label: group.label,
        icon: group.icon,
        routes: [route],
      });
      continue;
    }

    const entry = entries[existingIndex];
    if (entry?.kind === "group") {
      entry.routes.push(route);
    }
  }

  return entries;
}

export function sidebarGroupMatchesPath(routes: RouteConfig[], pathname: string): boolean {
  return routes.some((route) => pathname === route.path || pathname.startsWith(`${route.path}/`));
}
