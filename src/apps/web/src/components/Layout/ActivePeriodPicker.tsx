import { DatePickerField } from "@web/components/Fields/DatePickerField";
import { FormFieldLabel } from "@web/components/Fields/FormFieldLabel";
import { useActivePeriod } from "@web/contexts/ActivePeriod/Context";
import {
  ACTIVE_PERIOD_PRESETS,
  type ActivePeriodPreset,
  type ActivePeriodStored,
  accountDateToIso,
  activePeriodPresetLabel,
  compareIsoDates,
  isoToAccountDate,
} from "@web/utils/active-period";
import { useEffect, useId, useRef, useState } from "react";

type ActivePeriodPickerProps = {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  collapsed: boolean;
};

export function ActivePeriodPicker({
  open,
  onClose,
  anchorRef,
  collapsed,
}: ActivePeriodPickerProps) {
  const { stored, setPeriod, saving } = useActivePeriod();
  const panelId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [customError, setCustomError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    if (stored.preset === "custom") {
      setCustomFrom(isoToAccountDate(stored.from));
      setCustomTo(isoToAccountDate(stored.to));
    } else {
      setCustomFrom("");
      setCustomTo("");
    }
    setCustomError(null);
  }, [open, stored]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (panelRef.current?.contains(target)) {
        return;
      }
      if (anchorRef.current?.contains(target)) {
        return;
      }
      onClose();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose, anchorRef]);

  async function selectPreset(preset: Exclude<ActivePeriodPreset, "custom">) {
    await setPeriod({ preset });
    onClose();
  }

  async function applyCustom() {
    setCustomError(null);
    try {
      const fromIso = accountDateToIso(customFrom);
      const toIso = accountDateToIso(customTo);
      if (compareIsoDates(fromIso, toIso) > 0) {
        setCustomError("Start date must be on or before end date.");
        return;
      }
      const next: ActivePeriodStored = { preset: "custom", from: fromIso, to: toIso };
      await setPeriod(next);
      onClose();
    } catch {
      setCustomError("Enter valid dates (DD-MM-YYYY).");
    }
  }

  if (!open) {
    return null;
  }

  return (
    <div
      ref={panelRef}
      id={panelId}
      role="dialog"
      aria-label="Active Period"
      className={[
        "absolute z-20 w-80 rounded-sm border border-slate-200 bg-white p-4 shadow-lg",
        collapsed ? "bottom-0 left-full ml-2" : "bottom-0 left-full ml-2",
      ].join(" ")}
    >
      <p className="mb-3 text-sm font-semibold text-slate-900">Active Period</p>
      <ul className="mb-4 flex flex-col gap-0.5">
        {ACTIVE_PERIOD_PRESETS.filter((preset) => preset !== "custom").map((preset) => (
          <li key={preset}>
            <button
              type="button"
              disabled={saving}
              onClick={() => void selectPreset(preset)}
              className={[
                "w-full rounded-sm px-2 py-1.5 text-left text-sm transition",
                stored.preset === preset
                  ? "bg-blue-50 font-medium text-blue-700"
                  : "text-slate-700 hover:bg-slate-50",
              ].join(" ")}
            >
              {activePeriodPresetLabel(preset)}
            </button>
          </li>
        ))}
      </ul>

      <div className="border-t border-slate-100 pt-3">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
          Custom Range
        </p>
        <div className="space-y-3">
          <div className="space-y-1">
            <FormFieldLabel htmlFor="active-period-from">From</FormFieldLabel>
            <DatePickerField
              id="active-period-from"
              className="w-full"
              value={customFrom}
              onChange={setCustomFrom}
            />
          </div>
          <div className="space-y-1">
            <FormFieldLabel htmlFor="active-period-to">To</FormFieldLabel>
            <DatePickerField
              id="active-period-to"
              className="w-full"
              value={customTo}
              onChange={setCustomTo}
            />
          </div>
        </div>
        {customError ? <p className="mt-2 text-xs text-red-600">{customError}</p> : null}
        <button
          type="button"
          disabled={saving || !customFrom.trim() || !customTo.trim()}
          onClick={() => void applyCustom()}
          className="mt-3 w-full rounded-sm border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-800 transition hover:bg-slate-50 disabled:opacity-50"
        >
          Apply Custom Range
        </button>
      </div>
    </div>
  );
}
