export type BackupProfileFile = {
  display_name: string | null;
  client_settings: unknown;
};

export function serializeBackupProfile(
  displayName: string | null,
  clientSettings: Record<string, unknown> | null
): BackupProfileFile {
  return {
    display_name: displayName,
    client_settings: clientSettings,
  };
}

export function parseBackupProfile(raw: string): BackupProfileFile {
  const parsed = JSON.parse(raw) as {
    display_name?: unknown;
    client_settings?: unknown;
  };
  const displayName =
    parsed.display_name === null || parsed.display_name === undefined
      ? null
      : typeof parsed.display_name === "string"
        ? parsed.display_name
        : null;

  return {
    display_name: displayName,
    client_settings: parsed.client_settings ?? null,
  };
}
