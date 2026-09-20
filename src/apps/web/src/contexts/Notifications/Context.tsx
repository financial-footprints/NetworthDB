import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react";

export type NotificationVariant = "info" | "success" | "warning" | "error";

export type Notification = {
  id: string;
  message: string;
  variant: NotificationVariant;
};

type NotificationContextValue = {
  notifications: Notification[];
  pushNotification: (message: string, variant?: NotificationVariant) => void;
  dismissNotification: (id: string) => void;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const dismissNotification = useCallback((id: string) => {
    setNotifications((current) => current.filter((item) => item.id !== id));
  }, []);

  const pushNotification = useCallback((message: string, variant: NotificationVariant = "info") => {
    const id = crypto.randomUUID();
    setNotifications((current) => [...current, { id, message, variant }]);
  }, []);

  const value = useMemo(
    () => ({ notifications, pushNotification, dismissNotification }),
    [notifications, pushNotification, dismissNotification]
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications(): NotificationContextValue {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotifications must be used within NotificationProvider");
  }
  return context;
}
