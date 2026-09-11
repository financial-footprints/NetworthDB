import { FormRow } from "@web/components/fields/FormRow";
import { PasswordInput } from "@web/components/fields/PasswordInput";
import { emptyEmailSource } from "@web/utils/api/endpoints/sources";
import type {
  EmailSource,
  SourceConfig,
  SourceType,
  ThunderbirdSourceConfig,
} from "@web/utils/api/endpoints/sources/types";
import { useId } from "react";

type SourceFieldsProps = {
  source: SourceConfig;
  disabled?: boolean;
  onChange: (next: SourceConfig) => void;
};

export function SourceFields({ source, disabled = false, onChange }: SourceFieldsProps) {
  const labelFieldId = useId();
  const sourceTypeFieldId = useId();
  const profileFieldId = useId();
  const hostFieldId = useId();
  const portFieldId = useId();
  const folderFieldId = useId();
  const usernameFieldId = useId();
  const passwordFieldId = useId();
  const useSslFieldId = useId();

  return (
    <div className="space-y-4">
      <FormRow label="Label" htmlFor={labelFieldId} encryptionKind="server_encrypted">
        <input
          id={labelFieldId}
          className="form-input"
          value={source.label}
          onChange={(event) => onChange({ ...source, label: event.target.value })}
          placeholder="e.g. Work Gmail"
          disabled={disabled}
        />
      </FormRow>

      <FormRow
        label="Source Type"
        htmlFor={sourceTypeFieldId}
        required
        encryptionKind="server_encrypted"
      >
        <select
          id={sourceTypeFieldId}
          className="form-input"
          value={source.type}
          disabled={disabled}
          onChange={(event) => {
            const nextType = event.target.value as SourceType;
            if (nextType === source.type) {
              return;
            }
            if (nextType === "thunderbird") {
              onChange({
                id: source.id,
                label: source.label,
                type: "thunderbird",
                profile: "",
              });
              return;
            }
            onChange({
              ...emptyEmailSource(source.id),
              label: source.label,
            });
          }}
        >
          <option value="thunderbird">Thunderbird</option>
          <option value="email">Email</option>
        </select>
      </FormRow>

      {source.type === "thunderbird" ? (
        <FormRow
          label="Thunderbird Profile Path"
          htmlFor={profileFieldId}
          required
          encryptionKind="server_encrypted"
        >
          <input
            id={profileFieldId}
            className="form-input"
            value={source.profile}
            onChange={(event) =>
              onChange({
                ...(source as ThunderbirdSourceConfig),
                profile: event.target.value,
              })
            }
            placeholder="/path/to/thunderbird/profile"
            disabled={disabled}
          />
        </FormRow>
      ) : (
        <>
          <FormRow label="Host" htmlFor={hostFieldId} required encryptionKind="server_encrypted">
            <input
              id={hostFieldId}
              className="form-input"
              value={source.host}
              onChange={(event) =>
                onChange({
                  ...(source as EmailSource),
                  host: event.target.value,
                })
              }
              placeholder="imap.example.com"
              disabled={disabled}
            />
          </FormRow>
          <FormRow label="Port" htmlFor={portFieldId} encryptionKind="server_encrypted">
            <input
              id={portFieldId}
              type="number"
              className="form-input"
              value={source.port}
              onChange={(event) =>
                onChange({
                  ...(source as EmailSource),
                  port: Number(event.target.value) || 993,
                })
              }
              disabled={disabled}
            />
          </FormRow>
          <FormRow label="Folder" htmlFor={folderFieldId} encryptionKind="server_encrypted">
            <input
              id={folderFieldId}
              className="form-input"
              value={source.folder}
              onChange={(event) =>
                onChange({
                  ...(source as EmailSource),
                  folder: event.target.value,
                })
              }
              placeholder="INBOX or [Gmail]/All Mail"
              disabled={disabled}
            />
          </FormRow>
          <FormRow
            label="Username"
            htmlFor={usernameFieldId}
            required
            encryptionKind="server_encrypted"
          >
            <input
              id={usernameFieldId}
              className="form-input"
              value={source.username}
              onChange={(event) =>
                onChange({
                  ...(source as EmailSource),
                  username: event.target.value,
                })
              }
              placeholder="user@example.com"
              disabled={disabled}
            />
          </FormRow>
          <FormRow label="Password" htmlFor={passwordFieldId}>
            <PasswordInput
              id={passwordFieldId}
              encryptionKind="server_encrypted"
              value={"password" in source ? (source.password ?? "") : ""}
              placeholder={source.has_password ? "Update Stored Password" : "Enter Password"}
              onChange={(event) =>
                onChange({
                  ...source,
                  password: event.target.value,
                } as SourceConfig)
              }
              disabled={disabled}
              revealLabel="Password"
            />
          </FormRow>
          <FormRow label="Use SSL" htmlFor={useSslFieldId}>
            <input
              id={useSslFieldId}
              type="checkbox"
              checked={source.use_ssl}
              disabled={disabled}
              onChange={(event) =>
                onChange({
                  ...(source as EmailSource),
                  use_ssl: event.target.checked,
                })
              }
            />
          </FormRow>
        </>
      )}
    </div>
  );
}
