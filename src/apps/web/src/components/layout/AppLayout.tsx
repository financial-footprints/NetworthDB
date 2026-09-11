import { PageLoader } from "@web/components/layout/PageLoader";
import { Sidebar } from "@web/components/layout/Sidebar";
import { FileViewerProvider } from "@web/context/FileViewer/FileViewerContext";
import { FileViewerModal } from "@web/context/FileViewer/FileViewerModal";
import { NotificationProvider } from "@web/context/Notifications/NotificationContext";
import { NotificationToasts } from "@web/context/Notifications/NotificationToasts";
import { SettingsProvider } from "@web/context/Settings/SettingsContext";
import { SettingsModal } from "@web/context/Settings/SettingsModal";
import { Suspense } from "react";
import { Outlet } from "react-router-dom";

export function AppLayout() {
  return (
    <NotificationProvider>
      <FileViewerProvider>
        <SettingsProvider>
          <div className="flex h-screen">
            <Sidebar />
            <main className="flex min-h-0 flex-1 flex-col overflow-auto p-6">
              <Suspense fallback={<PageLoader />}>
                <Outlet />
              </Suspense>
            </main>
            <NotificationToasts />
            <FileViewerModal />
            <SettingsModal />
          </div>
        </SettingsProvider>
      </FileViewerProvider>
    </NotificationProvider>
  );
}
