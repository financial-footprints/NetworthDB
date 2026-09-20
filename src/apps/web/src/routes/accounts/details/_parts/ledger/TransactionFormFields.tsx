import { FormRow } from "@web/components/Fields/FormRow";
import { IsoDatePickerField } from "@web/components/Fields/IsoDatePickerField";
import type { CategoryApi } from "@web/utils/api/routes/categories/types";
import type { TagApi } from "@web/utils/api/routes/tags/types";
import { useId } from "react";

export type PickerOption = {
  id: string;
  label: string;
};

export type LedgerFormState = {
  date: string;
  amount: string;
  description: string;
  ref: string;
  sourceAccountId: string;
  destinationAccountId: string;
  categoryId: string;
  subcategoryId: string;
  tagIds: string[];
};

type TransactionFormFieldsProps = {
  form: LedgerFormState;
  onChange: (patch: Partial<LedgerFormState>) => void;
  partyOptions: PickerOption[];
  rootCategories: CategoryApi[];
  subcategoriesForCategory: (categoryId: string) => CategoryApi[];
  allTags: TagApi[];
};

function accountSelectOptions(selectOptions: PickerOption[], selectedId: string): PickerOption[] {
  if (!selectedId || selectOptions.some((option) => option.id === selectedId)) {
    return selectOptions;
  }
  return [...selectOptions, { id: selectedId, label: "Selected account" }];
}

export function TransactionFormFields({
  form,
  onChange,
  partyOptions,
  rootCategories,
  subcategoriesForCategory,
  allTags,
}: TransactionFormFieldsProps) {
  const sourceAccountIdField = useId();
  const destinationAccountIdField = useId();
  const dateId = useId();
  const amountId = useId();
  const descriptionId = useId();
  const refId = useId();
  const categoryId = useId();
  const subcategoryId = useId();

  return (
    <div className="space-y-4">
      <FormRow label="Source" htmlFor={sourceAccountIdField} required>
        <select
          id={sourceAccountIdField}
          className="form-input w-full"
          value={form.sourceAccountId}
          onChange={(event) => onChange({ sourceAccountId: event.target.value })}
          required
        >
          {accountSelectOptions(partyOptions, form.sourceAccountId).map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </FormRow>
      <FormRow label="Destination" htmlFor={destinationAccountIdField} required>
        <select
          id={destinationAccountIdField}
          className="form-input w-full"
          value={form.destinationAccountId}
          onChange={(event) => onChange({ destinationAccountId: event.target.value })}
          required
        >
          {accountSelectOptions(partyOptions, form.destinationAccountId).map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </FormRow>
      <FormRow label="Date" htmlFor={dateId} required>
        <IsoDatePickerField id={dateId} value={form.date} onChange={(date) => onChange({ date })} />
      </FormRow>
      <FormRow label="Amount" htmlFor={amountId} required>
        <input
          id={amountId}
          type="text"
          className="form-input w-full"
          placeholder="0.00"
          value={form.amount}
          onChange={(event) => onChange({ amount: event.target.value })}
          autoComplete="off"
          required
        />
      </FormRow>
      <FormRow label="Description" htmlFor={descriptionId} required>
        <input
          id={descriptionId}
          type="text"
          className="form-input w-full"
          value={form.description}
          onChange={(event) => onChange({ description: event.target.value })}
          required
        />
      </FormRow>
      <FormRow label="Reference" htmlFor={refId}>
        <input
          id={refId}
          type="text"
          className="form-input w-full"
          placeholder="Optional"
          value={form.ref}
          onChange={(event) => onChange({ ref: event.target.value })}
        />
      </FormRow>
      <FormRow label="Category" htmlFor={categoryId}>
        <select
          id={categoryId}
          className="form-input w-full"
          value={form.categoryId}
          onChange={(event) => onChange({ categoryId: event.target.value, subcategoryId: "" })}
        >
          <option value="">Uncategorized</option>
          {rootCategories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </FormRow>
      <FormRow label="Subcategory" htmlFor={subcategoryId}>
        <select
          id={subcategoryId}
          className="form-input w-full"
          value={form.subcategoryId}
          disabled={!form.categoryId}
          onChange={(event) => onChange({ subcategoryId: event.target.value })}
        >
          <option value="">None</option>
          {subcategoriesForCategory(form.categoryId).map((sub) => (
            <option key={sub.id} value={sub.id}>
              {sub.name}
            </option>
          ))}
        </select>
      </FormRow>
      <FormRow label="Tags">
        <div className="flex flex-wrap gap-3">
          {allTags.map((tag) => {
            const checked = form.tagIds.includes(tag.id);
            return (
              <label key={tag.id} className="inline-flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() =>
                    onChange({
                      tagIds: checked
                        ? form.tagIds.filter((id) => id !== tag.id)
                        : [...form.tagIds, tag.id],
                    })
                  }
                />
                {tag.name}
              </label>
            );
          })}
        </div>
        {allTags.length === 0 ? <p className="text-sm text-slate-500">No tags yet.</p> : null}
      </FormRow>
    </div>
  );
}
