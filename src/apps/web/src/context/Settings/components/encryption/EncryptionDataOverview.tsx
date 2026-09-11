import { HoverPopover } from "@web/components/popover";
import { EncryptionKindSymbol } from "@web/context/Settings/components/encryption/EncryptionKindSymbol";
import {
  type EncryptionFieldDefinition,
  type VisibleEncryptionModule,
  visibleEncryptionModules,
} from "@web/utils/crypto/types";
import { useState } from "react";

function EncryptionFieldTile({ field }: { field: EncryptionFieldDefinition }) {
  return (
    <div className="flex min-w-0 items-center gap-1.5 rounded-sm border border-slate-200 bg-white px-2 py-2 text-xs font-medium text-slate-800">
      <EncryptionKindSymbol kind={field.kind} />
      <span className="min-w-0 flex-1 truncate">{field.label}</span>
      {field.detail ? (
        <HoverPopover ariaLabel={`About ${field.label}`}>{field.detail}</HoverPopover>
      ) : null}
    </div>
  );
}

function EncryptionFieldGrid({
  fields,
  moduleId,
}: {
  fields: EncryptionFieldDefinition[];
  moduleId: string;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {fields.map((field) => (
        <EncryptionFieldTile key={`${moduleId}:${field.label}`} field={field} />
      ))}
    </div>
  );
}

function tabButtonClassName(isActive: boolean): string {
  return isActive
    ? "rounded-sm px-3 py-1.5 text-xs font-medium transition bg-blue-50 text-blue-700"
    : "rounded-sm px-3 py-1.5 text-xs font-medium transition text-slate-500 hover:bg-slate-100 hover:text-slate-900";
}

function EncryptionModuleTabs({ modules }: { modules: VisibleEncryptionModule[] }) {
  const defaultModuleId =
    modules.find(({ module }) => module.id === "profile")?.module.id ??
    modules[0]?.module.id ??
    "profile";
  const [activeModuleId, setActiveModuleId] = useState(defaultModuleId);
  const activeModule = modules.find(({ module }) => module.id === activeModuleId) ?? modules[0];

  if (activeModule === undefined) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div
        role="tablist"
        aria-label="Encryption data modules"
        className="flex flex-wrap gap-1 border-b border-slate-200 pb-2"
      >
        {modules.map(({ module }) => {
          const isActive = module.id === activeModule.module.id;
          return (
            <button
              key={module.id}
              type="button"
              role="tab"
              id={`encryption-tab-${module.id}`}
              aria-selected={isActive}
              aria-controls={`encryption-panel-${module.id}`}
              className={tabButtonClassName(isActive)}
              onClick={() => {
                setActiveModuleId(module.id);
              }}
            >
              {module.name}
            </button>
          );
        })}
      </div>
      <div
        role="tabpanel"
        id={`encryption-panel-${activeModule.module.id}`}
        aria-labelledby={`encryption-tab-${activeModule.module.id}`}
      >
        <EncryptionFieldGrid fields={activeModule.fields} moduleId={activeModule.module.id} />
      </div>
    </div>
  );
}

export function EncryptionDataOverview() {
  const modules = visibleEncryptionModules();

  if (modules.length === 0) {
    return null;
  }

  const showTabs = modules.length > 1;

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-slate-500">Field Encryption Information</p>
      {showTabs ? (
        <EncryptionModuleTabs modules={modules} />
      ) : (
        <EncryptionFieldGrid fields={modules[0].fields} moduleId={modules[0].module.id} />
      )}
    </div>
  );
}
