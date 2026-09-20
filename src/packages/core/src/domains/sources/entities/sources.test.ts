import { describe, expect, test } from "bun:test";
import { DEFAULT_EMAIL_PORT, UserSources } from "@core/domains/sources/entities/sources";
import { ValidationError } from "@core/shared/errors/domain-error";

describe("UserSources.normalize.email.port", () => {
  test("returns default when port is omitted", () => {
    expect(UserSources.normalize.email.port(undefined)).toBe(DEFAULT_EMAIL_PORT);
  });

  test("returns number as-is", () => {
    expect(UserSources.normalize.email.port(143)).toBe(143);
  });

  test("parses numeric strings", () => {
    expect(UserSources.normalize.email.port("995")).toBe(995);
  });

  test("falls back to default for invalid values", () => {
    expect(UserSources.normalize.email.port("")).toBe(DEFAULT_EMAIL_PORT);
    expect(UserSources.normalize.email.port("   ")).toBe(DEFAULT_EMAIL_PORT);
    expect(UserSources.normalize.email.port("not-a-port")).toBe(DEFAULT_EMAIL_PORT);
    expect(UserSources.normalize.email.port(Number.NaN)).toBe(DEFAULT_EMAIL_PORT);
  });
});

describe("UserSources.fromPersisted", () => {
  test("returns empty sources for invalid json", () => {
    const record = UserSources.fromPersisted("user-1", { invalid: true }, new Date(), new Date());
    expect(record.sources).toHaveLength(0);
  });

  test("reads canonical persisted shape", () => {
    const record = UserSources.fromPersisted(
      "user-1",
      {
        sources: [
          {
            id: "imap-1",
            type: "email",
            label: "",
            host: "imap.example.test",
            port: 993,
            username: "user@example.test",
            password: "secret",
            folder: "INBOX",
            useSsl: true,
          },
        ],
      },
      new Date(),
      new Date()
    );

    expect(record.sources[0]).toMatchObject({
      type: "email",
      port: 993,
      useSsl: true,
    });
  });
});

describe("UserSources", () => {
  const userId = "user-1";

  test("withSourcesUpdate replaces list and keeps email password by id", () => {
    const record = UserSources.empty(userId).withSourcesUpdate({
      sources: [
        {
          id: "imap-1",
          type: "email",
          label: "Work Gmail",
          host: "imap.example.test",
          port: 993,
          username: "user@example.test",
          password: "imap-secret",
          folder: "INBOX",
          useSsl: true,
        },
      ],
    });

    const updated = record.withSourcesUpdate({
      sources: [
        {
          id: "imap-1",
          type: "email",
          label: "Work Gmail",
          host: "imap.example.test",
          username: "user@example.test",
        },
      ],
    });

    expect(updated.sources).toHaveLength(1);
    expect(updated.sources[0]?.type).toBe("email");
    if (updated.sources[0]?.type === "email") {
      expect(updated.sources[0].password).toBe("imap-secret");
    }
  });

  test("withSourcesUpdate clears with empty list", () => {
    const record = UserSources.empty(userId).withSourcesUpdate({ sources: [] });
    expect(record.sources).toHaveLength(0);
  });

  test("withSourcesUpdate rejects duplicate ids", () => {
    expect(() =>
      UserSources.empty(userId).withSourcesUpdate({
        sources: [
          {
            id: "dup",
            type: "thunderbird",
            profile: "/path/a",
          },
          {
            id: "dup",
            type: "thunderbird",
            profile: "/path/b",
          },
        ],
      })
    ).toThrow(ValidationError);
  });

  test("withSourcesUpdate validates thunderbird profile", () => {
    expect(() =>
      UserSources.empty(userId).withSourcesUpdate({
        sources: [
          {
            id: "tb-1",
            type: "thunderbird",
            profile: "  ",
          },
        ],
      })
    ).toThrow(ValidationError);
  });
});
