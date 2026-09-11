import { beforeEach } from "bun:test";
import { clearSessionTokenCache } from "@web/utils/api/endpoints/auth/sessionTokens";

beforeEach(() => {
  clearSessionTokenCache();
});

const sessionStore = new Map<string, string>();

const sessionStorageMock: Storage = {
  getItem(key: string) {
    return sessionStore.has(key) ? (sessionStore.get(key) ?? null) : null;
  },
  setItem(key: string, value: string) {
    sessionStore.set(key, value);
  },
  removeItem(key: string) {
    sessionStore.delete(key);
  },
  clear() {
    sessionStore.clear();
  },
  key(index: number) {
    return [...sessionStore.keys()][index] ?? null;
  },
  get length() {
    return sessionStore.size;
  },
};

globalThis.sessionStorage = sessionStorageMock;

export function resetSessionStorage(): void {
  sessionStore.clear();
}
