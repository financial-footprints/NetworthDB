import { PageLoader } from "@web/components/Layout/PageLoader";
import { NotificationProvider } from "@web/contexts/Notifications/Context";
import { Toasts } from "@web/contexts/Notifications/Toasts";
import { Suspense } from "react";
import { Outlet } from "react-router-dom";

const LEARN_MORE_URL = "https://github.com/financial-footprints/";

export function LoginLayout() {
  return (
    <NotificationProvider>
      <div className="relative flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-3xl">
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </div>
        <a
          href={LEARN_MORE_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Learn more about Financial Footprints on GitHub"
          className="absolute top-6 right-6 text-sm text-slate-500 transition hover:text-slate-700 hover:underline"
        >
          About
        </a>
      </div>
      <Toasts />
    </NotificationProvider>
  );
}
