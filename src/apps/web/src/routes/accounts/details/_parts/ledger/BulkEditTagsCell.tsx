import type { TagApi } from "@web/utils/api/routes/tags/types";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

const CHIP_GAP_PX = 4;

type BulkEditTagsCellProps = {
  tagIds: string[];
  allTags: TagApi[];
  onChange: (tagIds: string[]) => void;
};

function computeVisibleChipCount(
  availableWidth: number,
  chipWidths: number[],
  overflowChipWidth: number
): number {
  const total = chipWidths.length;
  if (total === 0 || availableWidth <= 0) {
    return 0;
  }

  for (let visible = total; visible >= 1; visible -= 1) {
    let used = 0;
    for (let index = 0; index < visible; index += 1) {
      used += chipWidths[index];
      if (index > 0) {
        used += CHIP_GAP_PX;
      }
    }
    const hasOverflow = visible < total;
    if (hasOverflow) {
      used += CHIP_GAP_PX + overflowChipWidth;
    }
    if (used <= availableWidth) {
      return visible;
    }
  }

  if (overflowChipWidth + CHIP_GAP_PX <= availableWidth) {
    return 0;
  }

  return 1;
}

export function BulkEditTagsCell({ tagIds, allTags, onChange }: BulkEditTagsCellProps) {
  const [open, setOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const chipsRef = useRef<HTMLFieldSetElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(
    () => allTags.filter((tag) => tagIds.includes(tag.id)),
    [allTags, tagIds]
  );
  const catalogEmpty = allTags.length === 0;
  const overflowCount = Math.max(0, selected.length - visibleCount);

  useLayoutEffect(() => {
    if (selected.length === 0) {
      setVisibleCount(0);
      return;
    }

    const chipsEl = chipsRef.current;
    const measureEl = measureRef.current;
    if (!chipsEl || !measureEl) {
      setVisibleCount(selected.length);
      return;
    }

    function remeasure() {
      const chipsContainer = chipsRef.current;
      const measureContainer = measureRef.current;
      if (!chipsContainer || !measureContainer) {
        return;
      }
      const available = chipsContainer.clientWidth;
      const chipNodes = measureContainer.querySelectorAll<HTMLElement>("[data-tag-chip]");
      const chipWidths = Array.from(chipNodes).map((node) => node.getBoundingClientRect().width);
      const overflowNode = measureContainer.querySelector<HTMLElement>("[data-overflow-chip]");
      const overflowChipWidth = overflowNode?.getBoundingClientRect().width ?? 0;
      setVisibleCount(computeVisibleChipCount(available, chipWidths, overflowChipWidth));
    }

    remeasure();
    const observer = new ResizeObserver(remeasure);
    observer.observe(chipsEl);
    return () => observer.disconnect();
  }, [selected]);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    function onPointerDown(event: MouseEvent) {
      const root = rootRef.current;
      if (root && !root.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [open]);

  function openEditor() {
    if (catalogEmpty) {
      return;
    }
    setOpen((current) => !current);
  }

  const visibleTags = selected.slice(0, visibleCount);

  return (
    <div ref={rootRef} className="relative min-w-0">
      <div className="bulk-edit-tags-field">
        <fieldset ref={chipsRef} className="bulk-edit-tags-chips" aria-label="Selected tags">
          {visibleTags.map((tag) => (
            <span key={tag.id} className="bulk-edit-tags-chip" title={tag.name}>
              {tag.name}
            </span>
          ))}
          {overflowCount > 0 ? (
            <button
              type="button"
              className="bulk-edit-tags-chip bulk-edit-tags-chip-overflow"
              aria-expanded={open}
              aria-haspopup="listbox"
              onClick={openEditor}
            >
              +{overflowCount}
            </button>
          ) : null}
        </fieldset>
        <button
          type="button"
          className="bulk-edit-tags-add"
          disabled={catalogEmpty}
          aria-expanded={open}
          aria-haspopup="listbox"
          onClick={openEditor}
        >
          {catalogEmpty ? "None" : "Add Tags"}
        </button>
      </div>

      <div ref={measureRef} className="bulk-edit-tags-measure" aria-hidden>
        {selected.map((tag) => (
          <span key={tag.id} data-tag-chip className="bulk-edit-tags-chip">
            {tag.name}
          </span>
        ))}
        <span data-overflow-chip className="bulk-edit-tags-chip bulk-edit-tags-chip-overflow">
          +{selected.length}
        </span>
      </div>

      {open ? (
        <div className="bulk-edit-tags-popover" role="listbox" aria-label="Transaction tags">
          {allTags.map((tag) => {
            const checked = tagIds.includes(tag.id);
            return (
              <label key={tag.id} className="flex items-center gap-1.5 py-0.5 text-sm">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() =>
                    onChange(checked ? tagIds.filter((id) => id !== tag.id) : [...tagIds, tag.id])
                  }
                />
                {tag.name}
              </label>
            );
          })}
          {allTags.length === 0 ? <p className="text-sm text-slate-500">No tags yet.</p> : null}
        </div>
      ) : null}
    </div>
  );
}
