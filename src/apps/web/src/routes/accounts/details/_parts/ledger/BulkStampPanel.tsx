import { IconActionButton, SecondaryButton } from "@web/components/Button";
import { FormFieldLabel } from "@web/components/Fields/FormFieldLabel";
import { IsoDatePickerField } from "@web/components/Fields/IsoDatePickerField";
import type { PickerOption } from "@web/routes/accounts/details/_parts/ledger/TransactionFormFields";
import type { CategoryApi } from "@web/utils/api/routes/categories/types";
import type { TagApi } from "@web/utils/api/routes/tags/types";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { LuCheck, LuRotateCcw, LuTrash2 } from "react-icons/lu";

type StampFieldProps = {
  label: string;
  htmlFor?: string;
  className?: string;
  children: ReactNode;
};

function StampField({ label, htmlFor, className, children }: StampFieldProps) {
  return (
    <div className={className ? `block space-y-1 ${className}` : "block space-y-1"}>
      <FormFieldLabel htmlFor={htmlFor}>{label}</FormFieldLabel>
      {children}
    </div>
  );
}

export type BulkStampPanelProps = {
  noChangeValue: string;
  partyOptions: PickerOption[];
  rootCategories: CategoryApi[];
  subcategoriesForCategory: (categoryId: string) => CategoryApi[];
  subcategoryParent: string | null;
  allTags: TagApi[];
  applySource: string;
  setApplySource: Dispatch<SetStateAction<string>>;
  applyDestination: string;
  setApplyDestination: Dispatch<SetStateAction<string>>;
  applyDate: string;
  setApplyDate: Dispatch<SetStateAction<string>>;
  applyAmount: string;
  setApplyAmount: Dispatch<SetStateAction<string>>;
  applyDescription: string;
  setApplyDescription: Dispatch<SetStateAction<string>>;
  applyRef: string;
  setApplyRef: Dispatch<SetStateAction<string>>;
  applyCategory: string;
  setApplyCategory: Dispatch<SetStateAction<string>>;
  applySubcategory: string;
  setApplySubcategory: Dispatch<SetStateAction<string>>;
  applyTags: string[];
  setApplyTags: Dispatch<SetStateAction<string[]>>;
  tagMode: "add" | "replace";
  setTagMode: Dispatch<SetStateAction<"add" | "replace">>;
  sourceAccountIdField: string;
  destinationAccountIdField: string;
  bulkDateId: string;
  bulkAmountId: string;
  bulkDescriptionId: string;
  bulkRefId: string;
  bulkCategoryId: string;
  bulkSubcategoryId: string;
  canApplyToAll: boolean;
  stampFormError: string | null;
  onApplyToAll: () => void;
  onResetForm: () => void;
  onApplyTags: () => void;
  onClearTagsOnAllRows: () => void;
};

export function BulkStampPanel({
  noChangeValue,
  partyOptions,
  rootCategories,
  subcategoriesForCategory,
  subcategoryParent,
  allTags,
  applySource,
  setApplySource,
  applyDestination,
  setApplyDestination,
  applyDate,
  setApplyDate,
  applyAmount,
  setApplyAmount,
  applyDescription,
  setApplyDescription,
  applyRef,
  setApplyRef,
  applyCategory,
  setApplyCategory,
  applySubcategory,
  setApplySubcategory,
  applyTags,
  setApplyTags,
  tagMode,
  setTagMode,
  sourceAccountIdField,
  destinationAccountIdField,
  bulkDateId,
  bulkAmountId,
  bulkDescriptionId,
  bulkRefId,
  bulkCategoryId,
  bulkSubcategoryId,
  canApplyToAll,
  stampFormError,
  onApplyToAll,
  onResetForm,
  onApplyTags,
  onClearTagsOnAllRows,
}: BulkStampPanelProps) {
  return (
    <div className="bulk-edit-form-stack">
      <section className="bulk-edit-stamp-panel" aria-label="Bulk field values">
        <div className="bulk-edit-stamp-grid">
          <StampField label="Source" htmlFor={sourceAccountIdField}>
            <select
              id={sourceAccountIdField}
              className="form-input w-full"
              value={applySource}
              onChange={(event) => setApplySource(event.target.value)}
            >
              <option value={noChangeValue}>No Change</option>
              {partyOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </StampField>
          <StampField label="Destination" htmlFor={destinationAccountIdField}>
            <select
              id={destinationAccountIdField}
              className="form-input w-full"
              value={applyDestination}
              onChange={(event) => setApplyDestination(event.target.value)}
            >
              <option value={noChangeValue}>No Change</option>
              {partyOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </StampField>
          <StampField label="Amount" htmlFor={bulkAmountId}>
            <input
              id={bulkAmountId}
              type="text"
              className="form-input w-full"
              placeholder="No Change"
              value={applyAmount}
              onChange={(event) => setApplyAmount(event.target.value)}
            />
          </StampField>
          <StampField label="Date" htmlFor={bulkDateId}>
            <IsoDatePickerField
              id={bulkDateId}
              value={applyDate}
              isClearable
              onChange={(iso) => setApplyDate(iso)}
            />
          </StampField>
          <StampField label="Category" htmlFor={bulkCategoryId}>
            <select
              id={bulkCategoryId}
              className="form-input w-full"
              value={applyCategory}
              onChange={(event) => {
                const value = event.target.value;
                setApplyCategory(value);
                setApplySubcategory(noChangeValue);
              }}
            >
              <option value={noChangeValue}>No Change</option>
              <option value="">Uncategorized</option>
              {rootCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </StampField>
          <StampField label="Subcategory" htmlFor={bulkSubcategoryId}>
            <select
              id={bulkSubcategoryId}
              className="form-input w-full"
              value={applySubcategory}
              disabled={!subcategoryParent}
              onChange={(event) => setApplySubcategory(event.target.value)}
            >
              <option value={noChangeValue}>No Change</option>
              <option value="">None</option>
              {(subcategoryParent ? subcategoriesForCategory(subcategoryParent) : []).map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.name}
                </option>
              ))}
            </select>
          </StampField>
          <StampField
            label="Description"
            htmlFor={bulkDescriptionId}
            className="bulk-edit-stamp-span-full"
          >
            <input
              id={bulkDescriptionId}
              type="text"
              className="form-input w-full"
              placeholder="No Change"
              value={applyDescription}
              onChange={(event) => setApplyDescription(event.target.value)}
            />
          </StampField>
          <StampField label="Reference" htmlFor={bulkRefId} className="bulk-edit-stamp-span-full">
            <input
              id={bulkRefId}
              type="text"
              className="form-input w-full"
              placeholder="No Change"
              value={applyRef}
              onChange={(event) => setApplyRef(event.target.value)}
            />
          </StampField>
        </div>
        {stampFormError ? <p className="text-sm text-red-600">{stampFormError}</p> : null}
        <div className="bulk-edit-stamp-actions">
          <IconActionButton title="Reset Input Fields" onClick={onResetForm}>
            <LuRotateCcw className="size-4" strokeWidth={2} aria-hidden />
          </IconActionButton>
          <SecondaryButton
            type="button"
            disabled={!canApplyToAll}
            title="Apply to all the rows"
            onClick={onApplyToAll}
          >
            Apply
          </SecondaryButton>
        </div>
      </section>
      <section className="bulk-edit-tags-section" aria-labelledby="bulk-edit-tags-title">
        <div className="bulk-edit-tags-header">
          <div>
            <p id="bulk-edit-tags-title" className="bulk-edit-tags-section-title">
              Tags
            </p>
            <p className="bulk-edit-tags-hint">
              Tag changes use their own actions and are not included in Apply To All Rows.
            </p>
          </div>
          <div className="bulk-edit-tags-toolbar">
            <select
              className="form-input"
              aria-label="How to apply tags"
              value={tagMode}
              onChange={(event) => setTagMode(event.target.value as "add" | "replace")}
            >
              <option value="add">Add To Existing</option>
              <option value="replace">Replace Tags</option>
            </select>
            <IconActionButton
              title="Apply Tags"
              tone="edit"
              disabled={applyTags.length === 0}
              onClick={onApplyTags}
            >
              <LuCheck className="size-4" strokeWidth={2} aria-hidden />
            </IconActionButton>
            <IconActionButton
              title="Clear Tags On All Rows"
              tone="danger"
              onClick={onClearTagsOnAllRows}
            >
              <LuTrash2 className="size-4" strokeWidth={2} aria-hidden />
            </IconActionButton>
          </div>
        </div>
        <div className="bulk-edit-tags-list">
          {allTags.length === 0 ? (
            <p className="text-sm text-slate-500">No tags yet.</p>
          ) : (
            <div className="bulk-edit-tags-checkboxes">
              {allTags.map((tag) => {
                const checked = applyTags.includes(tag.id);
                return (
                  <label key={tag.id} className="inline-flex items-center gap-1.5 text-sm">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setApplyTags((current) =>
                          checked ? current.filter((id) => id !== tag.id) : [...current, tag.id]
                        )
                      }
                    />
                    {tag.name}
                  </label>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
