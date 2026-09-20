import { ErrorBoundary } from "@web/components/Error/ErrorBoundary";
import { View } from "@web/components/Error/View";
import { AppLayout } from "@web/components/Layout/AppLayout";
import { LoginLayout } from "@web/components/Layout/LoginLayout";
import { RequireAuth } from "@web/components/Layout/RequireAuth";
import { AuthProvider } from "@web/contexts/Auth/Context";
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
        <ErrorBoundary
          fallback={(props) => (
            <View
              fullPage
              message={props.error.message || "An unexpected error occurred."}
              onRetry={props.reset}
            />
          )}
        >
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
                </Route>
              </Route>
            </Routes>
          </AuthProvider>
        </ErrorBoundary>
      </BrowserRouter>
    </React.StrictMode>
  );
}
