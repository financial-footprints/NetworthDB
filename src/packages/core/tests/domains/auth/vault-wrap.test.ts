import { describe, expect, test } from "bun:test";
import {
  packBlob,
  unpackBlob,
  validateE2eeNameBlob,
  validateSlotWrapBlob,
} from "@core/domains/user/modules/vault/embedded/vault-wrap";
import { ValidationError } from "@core/shared/errors/domain-error";

describe("vault-wrap", () => {
  test("packBlob and unpackBlob round-trip", () => {
    const packed = packBlob("abc", "def");
    expect(unpackBlob(packed)).toEqual({ nonce: "abc", ciphertext: "def" });
  });

  test("validateSlotWrapBlob accepts dummy wrap", () => {
    validateSlotWrapBlob("abc.def");
  });

  test("validateE2eeNameBlob accepts dummy blob", () => {
    validateE2eeNameBlob("abc.def");
  });

  test("unpackBlob rejects invalid blobs", () => {
    expect(() => unpackBlob("")).toThrow(ValidationError);
    expect(() => unpackBlob("no-separator")).toThrow(ValidationError);
  });
});
