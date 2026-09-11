import { emailHasPassword, type Sources } from "@ndb/core";
import { sourcesSchema } from "@ndb/platform";

function serializeSourceData(source: Sources["sources"][number], includeSecrets: boolean) {
  if (source.type === "thunderbird") {
    return {
      id: source.id,
      type: source.type,
      label: source.label,
      profile: source.profile,
    };
  }

  const base = {
    id: source.id,
    type: source.type,
    label: source.label,
    host: source.host || "",
    port: source.port ?? 993,
    username: source.username || "",
    folder: source.folder || "INBOX",
    use_ssl: source.useSsl ?? true,
  };

  if (includeSecrets) {
    return {
      ...base,
      password: source.password ?? "",
    };
  }

  return {
    ...base,
    has_password: emailHasPassword(source),
  };
}

export function serializeSources(sources: Sources, includeSecrets: boolean) {
  return sourcesSchema.parse({
    data: {
      sources: sources.sources.map((source) => serializeSourceData(source, includeSecrets)),
    },
    errors: [],
  });
}
