import { DEFAULT_EMAIL_PORT } from "@core/domains/sources/constants";
import { ValidationError } from "@core/shared/errors/domain-error";

export type ThunderbirdSource = {
  id: string;
  type: "thunderbird";
  label: string;
  profile: string;
};

export type EmailSource = {
  id: string;
  type: "email";
  label: string;
  host: string;
  port: number;
  username: string;
  password: string | null;
  folder: string;
  useSsl: boolean;
};

export type Source = ThunderbirdSource | EmailSource;

export type Sources = {
  sources: Source[];
};

export type ThunderbirdSourceWriteInput = {
  id: string;
  type: "thunderbird";
  label?: string;
  profile: string;
};

export type EmailSourceWriteInput = {
  id: string;
  type: "email";
  label?: string;
  host: string;
  port?: number;
  username: string;
  password?: string;
  folder?: string;
  useSsl?: boolean;
};

export type SourceWriteInput = ThunderbirdSourceWriteInput | EmailSourceWriteInput;

export type SourcesUpdateInput = {
  sources: SourceWriteInput[];
};

export function emptySources(): Sources {
  return { sources: [] };
}

export function cloneSources(sources: Sources): Sources {
  return structuredClone(sources);
}

export function emailHasPassword(source: EmailSource): boolean {
  return Boolean(source.password);
}

export class UserSources {
  constructor(
    public readonly userId: string,
    public readonly sources: Source[],
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  static readonly normalize = {
    email: {
      port(port: number | string | undefined): number {
        if (port === undefined) {
          return DEFAULT_EMAIL_PORT;
        }

        if (typeof port === "number") {
          return Number.isFinite(port) ? port : DEFAULT_EMAIL_PORT;
        }

        const trimmed = port.trim();
        if (!trimmed) {
          return DEFAULT_EMAIL_PORT;
        }

        const parsed = Number.parseInt(trimmed, 10);
        return Number.isFinite(parsed) ? parsed : DEFAULT_EMAIL_PORT;
      },
    },

    label(label: string | undefined): string {
      if (label === undefined) {
        return "";
      }

      return label.trim();
    },
  };

  static empty(userId: string): UserSources {
    const now = new Date();
    return new UserSources(userId, [], now, now);
  }

  static fromPersisted(
    userId: string,
    json: unknown,
    createdAt: Date,
    updatedAt: Date
  ): UserSources {
    return new UserSources(userId, UserSources.parsePayload(json).sources, createdAt, updatedAt);
  }

  toPayload(): Sources {
    return { sources: [...this.sources] };
  }

  isEmpty(): boolean {
    return this.sources.length === 0;
  }

  withSourcesUpdate(input: SourcesUpdateInput): UserSources {
    const merged = mergeSourcesUpdate(this.sources, input);
    return this.clone({ sources: merged, updatedAt: new Date() });
  }

  private static parsePayload(json: unknown): Sources {
    if (typeof json !== "object" || json === null) {
      return emptySources();
    }

    const record = json as Partial<Sources>;
    if (!Array.isArray(record.sources)) {
      return emptySources();
    }

    return { sources: record.sources };
  }

  private clone(overrides: Partial<Pick<UserSources, "sources" | "updatedAt">>): UserSources {
    return new UserSources(
      this.userId,
      overrides.sources ?? this.sources,
      this.createdAt,
      overrides.updatedAt ?? this.updatedAt
    );
  }
}

function mergeSourcesUpdate(current: Source[], input: SourcesUpdateInput): Source[] {
  assertUniqueSourceIds(input.sources);
  const previousById = new Map(current.map((source) => [source.id, source]));

  return input.sources.map((item) => mergeSourceWrite(item, previousById.get(item.id)));
}

function assertUniqueSourceIds(items: SourceWriteInput[]): void {
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.id)) {
      throw new ValidationError("core.sources.invalid.duplicate-id", {
        field: "sources",
        id: item.id,
      });
    }

    seen.add(item.id);
  }
}

function mergeSourceWrite(input: SourceWriteInput, previous: Source | undefined): Source {
  if (input.type === "thunderbird") {
    return buildThunderbirdSource(input);
  }

  return buildEmailSource(input, previous);
}

function buildThunderbirdSource(input: ThunderbirdSourceWriteInput): ThunderbirdSource {
  const id = requireNonEmptyString(input.id, "id");
  const profile = requireNonEmptyString(input.profile, "profile");

  return {
    id,
    type: "thunderbird",
    label: UserSources.normalize.label(input.label),
    profile,
  };
}

function buildEmailSource(input: EmailSourceWriteInput, previous: Source | undefined): EmailSource {
  const id = requireNonEmptyString(input.id, "id");
  const host = requireNonEmptyString(input.host, "host");
  const username = requireNonEmptyString(input.username, "username");
  const password = resolveEmailPassword(input.password, previous);

  return {
    id,
    type: "email",
    label: UserSources.normalize.label(input.label),
    host,
    port: UserSources.normalize.email.port(input.port),
    username,
    password,
    folder: input.folder?.trim() || "INBOX",
    useSsl: input.useSsl ?? true,
  };
}

function resolveEmailPassword(
  incoming: string | undefined,
  previous: Source | undefined
): string | null {
  if (incoming !== undefined) {
    const trimmed = incoming.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (previous?.type === "email" && previous.password) {
    return previous.password;
  }

  return null;
}

function requireNonEmptyString(value: string, field: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new ValidationError("core.sources.invalid.required-field", {
      field,
    });
  }

  return trimmed;
}
