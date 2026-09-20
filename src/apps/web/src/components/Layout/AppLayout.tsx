import { PageLoader } from "@web/components/Layout/PageLoader";
import { Sidebar } from "@web/components/Layout/Sidebar";
import { ActivePeriodProvider } from "@web/contexts/ActivePeriod/Context";
import { FileViewerProvider } from "@web/contexts/FileViewer/Context";
import { Modal as FileViewerModal } from "@web/contexts/FileViewer/Modal";
import { NotificationProvider } from "@web/contexts/Notifications/Context";
import { Toasts } from "@web/contexts/Notifications/Toasts";
import { SettingsProvider } from "@web/contexts/Settings/Context";
import { Modal as SettingsModal } from "@web/contexts/Settings/Modal";
import { Suspense } from "react";
import { Outlet } from "react-router-dom";

export function AppLayout() {
  return (
    <NotificationProvider>
      <FileViewerProvider>
        <SettingsProvider>
          <ActivePeriodProvider>
            <div className="flex h-screen">
              <Sidebar />
              <main className="flex min-h-0 flex-1 flex-col overflow-auto p-6">
                <Suspense fallback={<PageLoader />}>
                  <Outlet />
                </Suspense>
              </main>
              <Toasts />
              <FileViewerModal />
              <SettingsModal />
            </div>
          </ActivePeriodProvider>
        </SettingsProvider>
      </FileViewerProvider>
    </NotificationProvider>
  );
}
