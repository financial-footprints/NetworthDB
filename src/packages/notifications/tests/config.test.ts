import { describe, expect, test } from "bun:test";
import { createEmailSender } from "@notifications/config";

function createTestLogger() {
  return {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
    child: () => createTestLogger(),
  };
}

describe("createEmailSender", () => {
  test("returns console sender for console channel", () => {
    const sender = createEmailSender({
      email: { channel: "console" },
      logger: createTestLogger() as never,
    });

    expect(typeof sender.sendEmail).toBe("function");
  });

  test("throws when smtp channel is missing smtp config", () => {
    expect(() =>
      createEmailSender({
        email: { channel: "smtp" },
        logger: createTestLogger() as never,
      })
    ).toThrow("notifications.config.email-smtp.required");
  });
});
