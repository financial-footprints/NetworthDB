import { useAuth } from "@web/contexts/Auth/Context";
import { useNotifications } from "@web/contexts/Notifications/Context";
import {
  type ActivePeriodPreset,
  type ActivePeriodStored,
  activePeriodPresetLabel,
  activePeriodRangeLabel,
  DEFAULT_ACTIVE_PERIOD_PRESET,
  isUnboundedActivePeriod,
  resolveActivePeriodRange,
  saveActivePeriod,
} from "@web/utils/active-period";
import { parseClientSettings } from "@web/utils/crypto/client-settings";
import { errorMessage } from "@web/utils/errors";
import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react";

type ActivePeriodContextValue = {
  stored: ActivePeriodStored;
  preset: ActivePeriodPreset;
  unbounded: boolean;
  from: string;
  to: string;
  label: string;
  rangeLabel: string;
  setPeriod: (stored: ActivePeriodStored) => Promise<void>;
  saving: boolean;
};

const ActivePeriodContext = createContext<ActivePeriodContextValue | null>(null);

function storedFromMe(
  me: { clientSettings?: Record<string, unknown> | null } | null
): ActivePeriodStored {
  const parsed = parseClientSettings(me?.clientSettings ?? null);
  if (parsed.active_period) {
    return parsed.active_period;
  }
  return { preset: DEFAULT_ACTIVE_PERIOD_PRESET };
}

export function ActivePeriodProvider({ children }: { children: ReactNode }) {
  const { me, applyMe } = useAuth();
  const { pushNotification } = useNotifications();
  const [optimisticStored, setOptimisticStored] = useState<ActivePeriodStored | null>(null);
  const [saving, setSaving] = useState(false);

  const stored = optimisticStored ?? storedFromMe(me);

  const unbounded = isUnboundedActivePeriod(stored);
  const { from, to } = useMemo(() => resolveActivePeriodRange(stored), [stored]);

  const label = activePeriodPresetLabel(stored.preset);
  const rangeLabel = unbounded ? "" : activePeriodRangeLabel(from, to);

  const setPeriod = useCallback(
    async (next: ActivePeriodStored) => {
      const previous = stored;
      setOptimisticStored(next);
      setSaving(true);
      try {
        const updatedMe = await saveActivePeriod(next);
        await applyMe(updatedMe);
        setOptimisticStored(null);
      } catch (err: unknown) {
        setOptimisticStored(previous);
        pushNotification(errorMessage(err, "Could not save active period"), "error");
      } finally {
        setSaving(false);
      }
    },
    [applyMe, pushNotification, stored]
  );

  const value = useMemo<ActivePeriodContextValue>(
    () => ({
      stored,
      preset: stored.preset,
      unbounded,
      from,
      to,
      label,
      rangeLabel,
      setPeriod,
      saving,
    }),
    [stored, unbounded, from, to, label, rangeLabel, setPeriod, saving]
  );

  return <ActivePeriodContext.Provider value={value}>{children}</ActivePeriodContext.Provider>;
}

export function useActivePeriod(): ActivePeriodContextValue {
  const context = useContext(ActivePeriodContext);
  if (!context) {
    throw new Error("useActivePeriod must be used within ActivePeriodProvider");
  }
  return context;
}
