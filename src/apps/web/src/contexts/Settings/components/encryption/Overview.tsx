import { SecondaryButton } from "@web/components/Button";
import { Hover } from "@web/components/Popover/Hover";
import { EncryptionKindSymbol } from "@web/contexts/Settings/components/encryption/Symbol";
import { useE2eeFieldToggle } from "@web/contexts/Settings/components/encryption/toggle";
import { Toggle } from "@web/contexts/Settings/modals/encryption/Toggle";
import { VaultPasswordModal } from "@web/contexts/Settings/modals/encryption/VaultPasswordModal";
import { isE2eeEnabled } from "@web/utils/crypto/client-settings";
import {
  type EncryptionFieldDefinition,
  type VisibleEncryptionModule,
  visibleEncryptionModules,
} from "@web/utils/crypto/types";
import { useState } from "react";

type EncryptionFieldTileProps = {
  field: EncryptionFieldDefinition;
  moduleId: string;
  e2eeEnabled: boolean;
  onToggleRequest?: () => void;
};

function EncryptionFieldTile({
  field,
  e2eeEnabled,
  onToggleRequest,
}: Omit<EncryptionFieldTileProps, "moduleId">) {
  const displayKind =
    field.e2eeFieldId !== undefined ? (e2eeEnabled ? "e2ee" : "server_plain") : field.kind;

  return (
    <div className="flex min-w-0 items-center gap-1.5 rounded-sm border border-slate-200 bg-white px-2 py-2 text-xs font-medium text-slate-800">
      <EncryptionKindSymbol kind={displayKind} />
      <span className="min-w-0 flex-1 truncate">{field.label}</span>
      {field.detail ? <Hover ariaLabel={`About ${field.label}`}>{field.detail}</Hover> : null}
      {field.e2eeFieldId !== undefined && onToggleRequest ? (
        <SecondaryButton
          type="button"
          className="shrink-0 px-2 py-1 text-xs"
          onClick={onToggleRequest}
        >
          {e2eeEnabled ? "Disable" : "Enable"}
        </SecondaryButton>
      ) : null}
    </div>
  );
}

function EncryptionFieldGrid({
  fields,
  moduleId,
  settings,
  onToggleRequest,
}: {
  fields: EncryptionFieldDefinition[];
  moduleId: string;
  settings: ReturnType<typeof useE2eeFieldToggle>["settings"];
  onToggleRequest: (field: EncryptionFieldDefinition) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {fields.map((field) => (
        <EncryptionFieldTile
          key={`${moduleId}:${field.label}`}
          field={field}
          e2eeEnabled={
            field.e2eeFieldId ? isE2eeEnabled(settings, field.e2eeFieldId) : field.kind === "e2ee"
          }
          onToggleRequest={
            field.e2eeFieldId
              ? () => {
                  onToggleRequest(field);
                }
              : undefined
          }
        />
      ))}
    </div>
  );
}

function tabButtonClassName(isActive: boolean): string {
  return isActive
    ? "rounded-sm px-3 py-1.5 text-xs font-medium transition bg-blue-50 text-blue-700"
    : "rounded-sm px-3 py-1.5 text-xs font-medium transition text-slate-500 hover:bg-slate-100 hover:text-slate-900";
}

function EncryptionModuleTabs({
  modules,
  settings,
  onToggleRequest,
}: {
  modules: VisibleEncryptionModule[];
  settings: ReturnType<typeof useE2eeFieldToggle>["settings"];
  onToggleRequest: (field: EncryptionFieldDefinition) => void;
}) {
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
        <EncryptionFieldGrid
          fields={activeModule.fields}
          moduleId={activeModule.module.id}
          settings={settings}
          onToggleRequest={onToggleRequest}
        />
      </div>
    </div>
  );
}

export function Overview() {
  const toggle = useE2eeFieldToggle();
  const modules = visibleEncryptionModules();

  if (modules.length === 0) {
    return null;
  }

  const showTabs = modules.length > 1;

  function handleToggleRequest(field: EncryptionFieldDefinition) {
    if (!field.e2eeFieldId) {
      return;
    }
    toggle.requestToggle(field.e2eeFieldId, field.label);
  }

  return (
    <>
      <div className="space-y-3">
        <p className="text-xs font-semibold text-slate-500">Field Encryption Information</p>
        {showTabs ? (
          <EncryptionModuleTabs
            modules={modules}
            settings={toggle.settings}
            onToggleRequest={handleToggleRequest}
          />
        ) : (
          <EncryptionFieldGrid
            fields={modules[0].fields}
            moduleId={modules[0].module.id}
            settings={toggle.settings}
            onToggleRequest={handleToggleRequest}
          />
        )}
      </div>

      <Toggle
        isOpen={toggle.pending !== null && !toggle.vaultPasswordOpen}
        fieldLabel={toggle.pending?.fieldLabel ?? ""}
        enable={toggle.pending?.enable ?? false}
        submitting={toggle.busy}
        errorMessages={toggle.errors}
        onClose={toggle.closeModal}
        onConfirm={toggle.confirmToggle}
      />

      <VaultPasswordModal
        isOpen={toggle.vaultPasswordOpen}
        mode="unlock"
        submitting={toggle.busy}
        errorMessages={toggle.errors}
        onClose={() => {
          if (!toggle.busy) {
            toggle.setVaultPasswordOpen(false);
          }
        }}
        onConfirm={(password) => {
          toggle.runRewriteWithPassword(password);
        }}
      />
    </>
  );
}
