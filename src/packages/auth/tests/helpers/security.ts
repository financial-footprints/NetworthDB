import type { PasswordLockout, RateLimiter } from "@ndb/core";
import { TEST_MULTIFACTOR_CONFIG } from "@tests/auth/helpers/config";

export const TEST_AUTH_RATE_LIMIT = 1000;
export const TEST_AUTH_RATE_WINDOW_MS = 60 * 1000;

class TestRateLimiter implements RateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number
  ) {}

  async allow(key: string): Promise<boolean> {
    const now = Date.now();
    const cutoff = now - this.windowMs;
    const existing = this.hits.get(key) ?? [];
    const filtered = existing.filter((timestamp) => timestamp > cutoff);

    if (filtered.length === 0) {
      this.hits.delete(key);
    } else {
      this.hits.set(key, filtered);
    }

    if (filtered.length >= this.limit) {
      return false;
    }

    this.hits.set(key, [...filtered, now]);
    return true;
  }
}

class TestPasswordLockout implements PasswordLockout {
  private readonly failures = new Map<string, number>();
  private readonly lockedUntil = new Map<string, number>();

  constructor(
    private readonly maxFailures: number,
    private readonly lockoutTtlMs: number
  ) {}

  async isLocked(username: string): Promise<boolean> {
    const until = this.lockedUntil.get(username);
    if (until === undefined) {
      return false;
    }

    if (Date.now() < until) {
      return true;
    }

    this.lockedUntil.delete(username);
    this.failures.delete(username);
    return false;
  }

  async recordFailure(username: string): Promise<void> {
    const next = (this.failures.get(username) ?? 0) + 1;
    if (next >= this.maxFailures) {
      this.lockedUntil.set(username, Date.now() + this.lockoutTtlMs);
      this.failures.set(username, 0);
      return;
    }

    this.failures.set(username, next);
  }

  async reset(username: string): Promise<void> {
    this.failures.delete(username);
    this.lockedUntil.delete(username);
  }
}

export function createTestSecurityStores(authRateLimit = TEST_AUTH_RATE_LIMIT) {
  return {
    rateLimiter: new TestRateLimiter(authRateLimit, TEST_AUTH_RATE_WINDOW_MS),
    passwordLockout: new TestPasswordLockout(
      TEST_MULTIFACTOR_CONFIG.mfaMaxFailures,
      TEST_MULTIFACTOR_CONFIG.ttl.lockout
    ),
  };
}
