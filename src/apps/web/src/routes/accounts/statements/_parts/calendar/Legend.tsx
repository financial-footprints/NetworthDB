import { CALENDAR_LEGEND_ITEMS } from "@web/routes/accounts/statements/_parts/calendar/helpers";
import { useEffect, useId, useRef, useState } from "react";
import { FaInfoCircle } from "react-icons/fa";
import "@web/assets/styles/calendar.css";

const LEGEND_LABEL = "Calendar color legend";

export function Legend() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const popoverId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        aria-label={LEGEND_LABEL}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={open ? popoverId : undefined}
        onClick={() => {
          setOpen((current) => !current);
        }}
        className="flex size-7 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
      >
        <FaInfoCircle className="size-4" aria-hidden />
      </button>

      {open ? (
        <div
          id={popoverId}
          role="dialog"
          aria-label={LEGEND_LABEL}
          className="absolute right-0 top-full z-10 mt-2 w-136 max-w-[calc(100vw-2rem)] rounded-sm border border-slate-200 bg-white p-4 shadow-lg"
        >
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Statement files
          </p>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                <th className="w-20 pb-2 pr-4" scope="col">
                  Color
                </th>
                <th className="pb-2" scope="col">
                  Meaning
                </th>
              </tr>
            </thead>
            <tbody className="text-slate-700">
              {CALENDAR_LEGEND_ITEMS.map((item) => (
                <tr key={item.label} className="border-b border-slate-50 last:border-0">
                  <td className="py-2.5 pr-4 align-middle">
                    <span
                      className={["inline-block size-7 rounded-sm ring-2", item.swatch].join(" ")}
                      aria-hidden
                    />
                  </td>
                  <td className="py-2.5 leading-relaxed">{item.label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
