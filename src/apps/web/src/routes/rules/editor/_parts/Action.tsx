import type { CategoryApi } from "@web/utils/api/routes/categories/types";
import type { CatalogItem } from "@web/utils/api/routes/rules/types";
import type { TagApi } from "@web/utils/api/routes/tags/types";
import { type ReactNode, useState } from "react";

type ActionEditorProps = {
  actions: CatalogItem[];
  onChange: (actions: CatalogItem[]) => void;
  categories: CategoryApi[];
  tags: TagApi[];
  accountOptions: { id: string; label: string }[];
};

const COMMON = [
  ["set_category", "Set category"],
  ["clear_category", "Clear category"],
  ["add_tag", "Add tag"],
  ["remove_tag", "Remove tag"],
  ["clear_tags", "Clear tags"],
  ["set_description", "Set description"],
  ["append_description", "Append to description"],
  ["set_ref_no", "Set reference"],
  ["clear_ref_no", "Clear reference"],
  ["delete_transaction", "Delete the transaction"],
] as const;

const MORE = [
  ["prepend_description", "Prepend to description"],
  ["replace_in_description", "Replace in description"],
  ["set_tags", "Replace tags"],
  ["set_source_account", "Set source account"],
  ["set_destination_account", "Set destination account"],
  ["set_source_system", "Set source to system account"],
  ["set_destination_system", "Set destination to system account"],
] as const;

function blankAction(type: string): CatalogItem {
  if (type === "set_category") {
    return { type, categoryId: "", subcategoryId: null };
  }
  if (type === "add_tag" || type === "remove_tag") {
    return { type, tagId: "" };
  }
  if (
    type === "set_description" ||
    type === "append_description" ||
    type === "prepend_description" ||
    type === "set_ref_no"
  ) {
    return { type, value: "" };
  }
  if (type === "replace_in_description") {
    return { type, find: "", replace: "" };
  }
  if (type === "set_tags") {
    return { type, tagIds: [] };
  }
  if (type === "set_source_account" || type === "set_destination_account") {
    return { type, accountId: "" };
  }
  if (type === "set_source_system") {
    return { type, accountType: "unknown" };
  }
  if (type === "set_destination_system") {
    return { type, accountType: "unknown" };
  }
  return { type };
}

function textValue(item: CatalogItem, key: string): string {
  const value = (item as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}

export function actionIsComplete(item: CatalogItem): boolean {
  if (item.type === "set_category") {
    return textValue(item, "categoryId").length > 0;
  }
  if (item.type === "add_tag" || item.type === "remove_tag") {
    return textValue(item, "tagId").length > 0;
  }
  if (
    item.type === "set_description" ||
    item.type === "append_description" ||
    item.type === "prepend_description" ||
    item.type === "set_ref_no"
  ) {
    return textValue(item, "value").trim().length > 0;
  }
  if (item.type === "replace_in_description") {
    return textValue(item, "find").length > 0;
  }
  if (item.type === "set_tags") {
    const tagIds = (item as Record<string, unknown>).tagIds;
    return Array.isArray(tagIds) && tagIds.length > 0;
  }
  if (item.type === "set_source_account" || item.type === "set_destination_account") {
    return textValue(item, "accountId").length > 0;
  }
  return true;
}

export function Action({ actions, onChange, categories, tags, accountOptions }: ActionEditorProps) {
  const [menu, setMenu] = useState("");
  const roots = categories.filter((category) => category.parentId === null);

  function update(index: number, next: CatalogItem) {
    onChange(actions.map((item, itemIndex) => (itemIndex === index ? next : item)));
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-slate-800">Then</p>
      {actions.length === 0 ? (
        <p className="text-sm text-slate-500">Add what should happen when this matches.</p>
      ) : null}
      <ul className="space-y-2">
        {actions.map((action, index) => (
          <li
            // biome-ignore lint/suspicious/noArrayIndexKey: actions are edited by list position
            key={index}
            className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 px-3 py-2"
          >
            <ActionFields
              action={action}
              roots={roots}
              categories={categories}
              tags={tags}
              accountOptions={accountOptions}
              onChange={(next) => update(index, next)}
            />
            <button
              type="button"
              className="text-sm text-red-600"
              onClick={() => onChange(actions.filter((_, itemIndex) => itemIndex !== index))}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      <select
        className="form-input w-full max-w-xs"
        value={menu}
        onChange={(event) => {
          const type = event.target.value;
          setMenu("");
          if (type) {
            onChange([...actions, blankAction(type)]);
          }
        }}
      >
        <option value="">Add action</option>
        {COMMON.map(([type, label]) => (
          <option key={type} value={type}>
            {label}
          </option>
        ))}
        <option disabled>More</option>
        {MORE.map(([type, label]) => (
          <option key={type} value={type}>
            {label}
          </option>
        ))}
      </select>
    </div>
  );
}

type ActionFieldProps = {
  action: CatalogItem;
  roots: CategoryApi[];
  categories: CategoryApi[];
  tags: TagApi[];
  accountOptions: { id: string; label: string }[];
  onChange: (next: CatalogItem) => void;
};

const DESCRIPTION_LABELS: Record<string, string> = {
  set_description: "Set description to",
  append_description: "Append to description",
  prepend_description: "Prepend to description",
};

function ActionFields(props: ActionFieldProps) {
  const Fields = ACTION_FIELDS[props.action.type];
  if (!Fields) {
    return <span className="text-sm text-slate-700">{props.action.type}</span>;
  }
  return <Fields {...props} />;
}

function SetCategoryFields({ action, roots, categories, onChange }: ActionFieldProps) {
  const categoryId = textValue(action, "categoryId");
  const children = categories.filter((category) => category.parentId === categoryId);
  return (
    <>
      <span className="text-sm text-slate-700">Set category to</span>
      <select
        className="form-input"
        value={categoryId}
        onChange={(event) =>
          onChange({ ...action, categoryId: event.target.value, subcategoryId: null })
        }
      >
        <option value="">Select…</option>
        {roots.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </select>
      <select
        className="form-input"
        value={textValue(action, "subcategoryId")}
        onChange={(event) => onChange({ ...action, subcategoryId: event.target.value || null })}
      >
        <option value="">Subcategory</option>
        {children.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </select>
    </>
  );
}

function TagActionFields({ action, tags, onChange }: ActionFieldProps) {
  return (
    <>
      <span className="text-sm text-slate-700">
        {action.type === "add_tag" ? "Add tag" : "Remove tag"}
      </span>
      <TagSelect
        tags={tags}
        value={textValue(action, "tagId")}
        onChange={(tagId) => onChange({ ...action, tagId })}
      />
    </>
  );
}

function DescriptionFields({ action, onChange }: ActionFieldProps) {
  return (
    <>
      <span className="text-sm text-slate-700">{DESCRIPTION_LABELS[action.type]}</span>
      <input
        className="form-input min-w-48 flex-1"
        value={textValue(action, "value")}
        onChange={(event) => onChange({ ...action, value: event.target.value })}
      />
    </>
  );
}

function TextActionFields({ action, onChange, label }: ActionFieldProps & { label: string }) {
  return (
    <>
      <span className="text-sm text-slate-700">{label}</span>
      <input
        className="form-input min-w-48 flex-1"
        value={textValue(action, "value")}
        onChange={(event) => onChange({ ...action, value: event.target.value })}
      />
    </>
  );
}

function ReplaceDescriptionFields({ action, onChange }: ActionFieldProps) {
  return (
    <>
      <span className="text-sm text-slate-700">Replace in description</span>
      <input
        className="form-input"
        placeholder="Find"
        value={textValue(action, "find")}
        onChange={(event) => onChange({ ...action, find: event.target.value })}
      />
      <input
        className="form-input"
        placeholder="Replace"
        value={textValue(action, "replace")}
        onChange={(event) => onChange({ ...action, replace: event.target.value })}
      />
    </>
  );
}

function tagIdList(action: CatalogItem): string[] {
  const rawTagIds = (action as Record<string, unknown>).tagIds;
  if (!Array.isArray(rawTagIds)) {
    return [];
  }
  return rawTagIds.filter((id): id is string => typeof id === "string");
}

function SetTagsFields({ action, tags, onChange }: ActionFieldProps) {
  const tagIds = tagIdList(action);
  return (
    <>
      <span className="text-sm text-slate-700">Replace tags with</span>
      <TagSelect
        tags={tags.filter((tag) => !tagIds.includes(tag.id))}
        value=""
        onChange={(tagId) => {
          if (tagId && tagIds.length < 20) {
            onChange({ ...action, tagIds: [...tagIds, tagId] });
          }
        }}
      />
      {tagIds.map((tagId) => (
        <button
          key={tagId}
          type="button"
          className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
          onClick={() => onChange({ ...action, tagIds: tagIds.filter((id) => id !== tagId) })}
        >
          {tags.find((tag) => tag.id === tagId)?.name ?? tagId} ×
        </button>
      ))}
    </>
  );
}

function AccountActionFields({ action, accountOptions, onChange }: ActionFieldProps) {
  return (
    <>
      <span className="text-sm text-slate-700">
        {action.type === "set_source_account"
          ? "Set source account to"
          : "Set destination account to"}
      </span>
      <AccountSelect
        accountOptions={accountOptions}
        value={textValue(action, "accountId")}
        onChange={(accountId) => onChange({ ...action, accountId })}
      />
    </>
  );
}

function SystemAccountFields({
  action,
  onChange,
  label,
  options,
}: ActionFieldProps & { label: string; options: string[] }) {
  return (
    <>
      <span className="text-sm text-slate-700">{label}</span>
      <select
        className="form-input"
        value={textValue(action, "accountType") || "unknown"}
        onChange={(event) => onChange({ ...action, accountType: event.target.value })}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </>
  );
}

function labelFields(label: string): (props: ActionFieldProps) => ReactNode {
  return function LabelFields() {
    return <span className="text-sm text-slate-700">{label}</span>;
  };
}

const ACTION_FIELDS: Record<string, (props: ActionFieldProps) => ReactNode> = {
  set_category: SetCategoryFields,
  clear_category: labelFields("Clear category"),
  add_tag: TagActionFields,
  remove_tag: TagActionFields,
  clear_tags: labelFields("Clear tags"),
  set_description: DescriptionFields,
  append_description: DescriptionFields,
  prepend_description: DescriptionFields,
  set_ref_no: (props) => <TextActionFields {...props} label="Set reference to" />,
  clear_ref_no: labelFields("Clear reference"),
  delete_transaction: labelFields("Delete the transaction"),
  replace_in_description: ReplaceDescriptionFields,
  set_tags: SetTagsFields,
  set_source_account: AccountActionFields,
  set_destination_account: AccountActionFields,
  set_source_system: (props) => (
    <SystemAccountFields
      {...props}
      label="Set source to"
      options={["unknown", "revenue", "tumbler"]}
    />
  ),
  set_destination_system: (props) => (
    <SystemAccountFields
      {...props}
      label="Set destination to"
      options={["unknown", "expense", "tumbler"]}
    />
  ),
};

function TagSelect({
  tags,
  value,
  onChange,
}: {
  tags: TagApi[];
  value: string;
  onChange: (tagId: string) => void;
}) {
  return (
    <select className="form-input" value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">Select…</option>
      {tags.map((tag) => (
        <option key={tag.id} value={tag.id}>
          {tag.name}
        </option>
      ))}
    </select>
  );
}

function AccountSelect({
  accountOptions,
  value,
  onChange,
}: {
  accountOptions: { id: string; label: string }[];
  value: string;
  onChange: (accountId: string) => void;
}) {
  return (
    <select className="form-input" value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">Select…</option>
      {accountOptions.map((option) => (
        <option key={option.id} value={option.id}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
