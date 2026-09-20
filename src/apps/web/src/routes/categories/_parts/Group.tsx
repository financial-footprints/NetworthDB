import { ConfirmDeleteButton, IconActionButton } from "@web/components/Button";
import type { CategoryApi } from "@web/utils/api/routes/categories/types";
import { useEffect, useState } from "react";
import { LuChevronDown, LuChevronRight, LuPencil, LuPlus } from "react-icons/lu";

type CategoryGroupSectionProps = {
  root: CategoryApi;
  subcategories: CategoryApi[];
  forceExpanded: boolean;
  expansionRevision: number;
  expansionTarget: boolean;
  onEdit: (category: CategoryApi) => void;
  onAddSubcategory: (parent: CategoryApi) => void;
  onDelete: (category: CategoryApi) => Promise<void>;
};

function subcategoryLabel(count: number): string {
  return count === 1 ? "1 subcategory" : `${count} subcategories`;
}

export function Group({
  root,
  subcategories,
  forceExpanded,
  expansionRevision,
  expansionTarget,
  onEdit,
  onAddSubcategory,
  onDelete,
}: CategoryGroupSectionProps) {
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    if (forceExpanded) {
      setExpanded(true);
    }
  }, [forceExpanded]);

  useEffect(() => {
    if (expansionRevision > 0) {
      setExpanded(expansionTarget);
    }
  }, [expansionRevision, expansionTarget]);

  const canCollapse = subcategories.length > 0;

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="flex items-center gap-2 px-3 py-2">
        {canCollapse ? (
          <button
            type="button"
            className="flex size-8 shrink-0 items-center justify-center rounded-sm text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-expanded={expanded}
            aria-label={expanded ? `Collapse ${root.name}` : `Expand ${root.name}`}
            onClick={() => setExpanded((current) => !current)}
          >
            {expanded ? (
              <LuChevronDown className="size-4" strokeWidth={1.75} aria-hidden />
            ) : (
              <LuChevronRight className="size-4" strokeWidth={1.75} aria-hidden />
            )}
          </button>
        ) : (
          <span className="size-8 shrink-0" aria-hidden />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900">{root.name}</p>
          {subcategories.length > 0 ? (
            <p className="text-xs text-slate-500">{subcategoryLabel(subcategories.length)}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <IconActionButton title="Edit" tone="edit" onClick={() => onEdit(root)}>
            <LuPencil className="size-4" strokeWidth={1.75} aria-hidden />
          </IconActionButton>
          <IconActionButton title="Add Subcategory" onClick={() => onAddSubcategory(root)}>
            <LuPlus className="size-4" strokeWidth={1.75} aria-hidden />
          </IconActionButton>
          <ConfirmDeleteButton
            variant="icon"
            title="Delete"
            confirmMessage="Delete this category and its subcategories? Transactions stay, but lose this classification."
            onDelete={() => onDelete(root)}
          />
        </div>
      </div>
      {canCollapse && expanded ? (
        <ul className="divide-y divide-slate-100 border-t border-slate-100">
          {subcategories.map((child) => (
            <li key={child.id} className="flex items-center gap-2 py-1.5 pr-3 pl-12">
              <p className="min-w-0 flex-1 truncate text-sm text-slate-700">{child.name}</p>
              <div className="flex shrink-0 items-center gap-0.5">
                <IconActionButton title="Edit" tone="edit" onClick={() => onEdit(child)}>
                  <LuPencil className="size-4" strokeWidth={1.75} aria-hidden />
                </IconActionButton>
                <ConfirmDeleteButton
                  variant="icon"
                  title="Delete"
                  confirmMessage="Delete this subcategory?"
                  onDelete={() => onDelete(child)}
                />
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
