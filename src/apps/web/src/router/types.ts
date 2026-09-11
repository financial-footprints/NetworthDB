import type { ReactNode } from "react";

type RouteAppConfig = {
  /** When true, route is public and does not require authentication. */
  public?: boolean;
};

export type RouteConfig = {
  path: string;
  element: ReactNode;
  label: string;
  app?: RouteAppConfig;
  sidebar?: {
    show: true;
    icon: ReactNode;
    group?: string;
    groupIcon?: ReactNode;
  };
};
