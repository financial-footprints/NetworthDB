import { ValidationError } from "@core/shared/errors/domain-error";

const MAX_CLIENT_SETTINGS_BYTES = 8192;

export type ClientSettingsJson = Record<string, unknown>;

export class ClientSettings {
  private constructor(private readonly value: ClientSettingsJson) {}

  static parse(raw: unknown): ClientSettings {
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
      throw new ValidationError("Client settings must be an object.", {
        field: "client_settings",
      });
    }

    const serialized = JSON.stringify(raw);
    if (serialized.length > MAX_CLIENT_SETTINGS_BYTES) {
      throw new ValidationError("Client settings are too large.", {
        field: "client_settings",
      });
    }

    return new ClientSettings(raw as ClientSettingsJson);
  }

  toJson(): ClientSettingsJson {
    return this.value;
  }
}
