import { AppErrorView } from "@web/components/error/AppErrorView";
import { ErrorBoundary } from "@web/components/error/ErrorBoundary";
import { NotFoundView } from "@web/components/error/NotFoundView";
import { AppLayout } from "@web/components/layout/AppLayout";
import { LoginLayout } from "@web/components/layout/LoginLayout";
import { RequireAuth } from "@web/components/layout/RequireAuth";
import { AuthProvider } from "@web/context/Auth/AuthContext";
import { routes as allRoutes } from "@web/router/routes";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";

import "@web/assets/styles/base.css";

const publicRoutes = allRoutes.filter((route) => route.app?.public === true);
const protectedRoutes = allRoutes.filter((route) => route.app?.public !== true);

const rootEl = document.getElementById("root");
if (rootEl) {
  const root = ReactDOM.createRoot(rootEl);
  root.render(
    <React.StrictMode>
      <BrowserRouter>
        <ErrorBoundary fallback={(props) => <AppErrorView {...props} />}>
          <AuthProvider>
            <Routes>
              <Route element={<LoginLayout />}>
                {publicRoutes.map((route) => (
                  <Route
                    key={route.path}
                    path={route.path.replace(/^\//, "")}
                    element={route.element}
                  />
                ))}
              </Route>
              <Route element={<RequireAuth />}>
                <Route element={<AppLayout />}>
                  {protectedRoutes.map((route) => (
                    <Route
                      key={route.path}
                      {...(route.path === "/"
                        ? { index: true }
                        : { path: route.path.replace(/^\//, "") })}
                      element={route.element}
                    />
                  ))}
                  <Route path="*" element={<NotFoundView />} />
                </Route>
              </Route>
            </Routes>
          </AuthProvider>
        </ErrorBoundary>
      </BrowserRouter>
    </React.StrictMode>
  );
}
