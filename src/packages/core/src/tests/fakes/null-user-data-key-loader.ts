import type { UserDataKeyLoader } from "@core/ports/encryption";

export const nullUserDataKeyLoader: UserDataKeyLoader = {
  ensure: async () => null,
  get: async () => null,
};
