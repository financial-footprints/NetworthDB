import { log } from "@web/logging";
import { useEffect } from "react";

type UsePollingWhileActiveOptions = {
  isActive: boolean;
  intervalMs: number;
  poll: () => Promise<void>;
  failedEventId: string;
  path: string;
};

export function usePollingWhileActive({
  isActive,
  intervalMs,
  poll,
  failedEventId,
  path,
}: UsePollingWhileActiveOptions): void {
  useEffect(() => {
    if (!isActive) {
      return;
    }

    let inFlight = false;

    const intervalId = window.setInterval(() => {
      if (inFlight) {
        return;
      }
      inFlight = true;
      poll()
        .catch(() => {
          log("warn", failedEventId, { path });
        })
        .finally(() => {
          inFlight = false;
        });
    }, intervalMs);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isActive, intervalMs, poll, failedEventId, path]);
}
