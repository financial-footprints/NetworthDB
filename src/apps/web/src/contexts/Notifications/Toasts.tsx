import {
  type Notification,
  type NotificationVariant,
  useNotifications,
} from "@web/contexts/Notifications/Context";
import { useEffect } from "react";

const AUTO_DISMISS_MS = 4000;

const variantStyles: Record<NotificationVariant, string> = {
  info: "border-blue-200 bg-white text-slate-800",
  success: "border-green-200 bg-green-50 text-green-800",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  error: "border-red-200 bg-red-50 text-red-900",
};

const variantAccent: Record<NotificationVariant, string> = {
  info: "bg-blue-500",
  success: "bg-green-500",
  warning: "bg-amber-500",
  error: "bg-red-500",
};

function ToastItem({ notification }: { notification: Notification }) {
  const { dismissNotification } = useNotifications();

  useEffect(() => {
    const timer = setTimeout(() => {
      dismissNotification(notification.id);
    }, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [dismissNotification, notification.id]);

  return (
    <output
      aria-live="polite"
      className={`flex overflow-hidden rounded-sm border shadow-sm ${variantStyles[notification.variant]}`}
    >
      <div className={`w-1 shrink-0 ${variantAccent[notification.variant]}`} aria-hidden />
      <p className="px-4 py-3 text-sm leading-relaxed">{notification.message}</p>
    </output>
  );
}

export function Toasts() {
  const { notifications } = useNotifications();

  if (notifications.length === 0) {
    return null;
  }

  return (
    <div className="toast-stack pointer-events-none fixed top-4 right-4 flex w-full max-w-sm flex-col gap-2">
      {notifications.map((notification) => (
        <ToastItem key={notification.id} notification={notification} />
      ))}
    </div>
  );
}
