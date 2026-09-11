import { PageLoader } from "@web/components/layout/PageLoader";
import { useAuth } from "@web/context/Auth/AuthContext";
import { path } from "@web/router/routes";
import { Navigate, Outlet, useLocation } from "react-router-dom";

export function RequireAuth() {
  const { status, vaultStatus } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return <PageLoader />;
  }

  if (status === "anonymous") {
    return <Navigate to={path.login} replace state={{ from: location }} />;
  }

  if (vaultStatus !== "unlocked") {
    return <Navigate to={path.login} replace state={{ from: location }} />;
  }

  return <Outlet />;
}
