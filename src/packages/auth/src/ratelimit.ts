import type { Logger, PasswordLockout, RateLimiter } from "@ndb/core";
import { RateLimiterRedis, type RateLimiterRes } from "rate-limiter-flexible";
import { createClient, type RedisClientType } from "redis";

export type KvstoreAuthLimitsConfig = {
  kvstore: {
    url: string;
  };
  rate: {
    limit: number;
    windowMs: number;
  };
  lockout: {
    maxFailures: number;
    ttl: number;
  };
  logger: Logger;
};

function isRateLimitExceeded(value: unknown): value is RateLimiterRes {
  return (
    typeof value === "object" &&
    value !== null &&
    "msBeforeNext" in value &&
    "remainingPoints" in value
  );
}

function createRequestRateLimiter(limiter: RateLimiterRedis, logger: Logger): RateLimiter {
  return {
    async allow(key: string): Promise<boolean> {
      try {
        await limiter.consume(key);
        return true;
      } catch (error) {
        if (isRateLimitExceeded(error)) {
          return false;
        }

        logger.warn("auth.kvstore.rate-limit.failed-open", {
          key,
          reason: error instanceof Error ? error.message : String(error),
        });
        return true;
      }
    },
  };
}

// Failures count within duration; exceeding points blocks for blockDuration (not unbounded INCR keys).
function createPasswordLockout(limiter: RateLimiterRedis, logger: Logger): PasswordLockout {
  return {
    async isLocked(username: string): Promise<boolean> {
      try {
        const res = await limiter.get(username);
        if (!res) {
          return false;
        }

        return res.remainingPoints <= 0 && res.msBeforeNext > 0;
      } catch (error) {
        logger.warn("auth.kvstore.password-lockout.is-locked.failed-open", {
          username,
          reason: error instanceof Error ? error.message : String(error),
        });
        return false;
      }
    },

    async recordFailure(username: string): Promise<void> {
      try {
        await limiter.consume(username);
      } catch (error) {
        if (isRateLimitExceeded(error)) {
          return;
        }

        logger.warn("auth.kvstore.password-lockout.record-failure.failed-open", {
          username,
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    },

    async reset(username: string): Promise<void> {
      try {
        await limiter.delete(username);
      } catch (error) {
        logger.warn("auth.kvstore.password-lockout.reset.failed-open", {
          username,
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    },
  };
}

export class KvstoreAuthLimits {
  readonly rateLimiter: RateLimiter;
  readonly passwordLockout: PasswordLockout;

  private constructor(
    rateLimiter: RateLimiter,
    passwordLockout: PasswordLockout,
    private readonly disconnect: () => Promise<void>
  ) {
    this.rateLimiter = rateLimiter;
    this.passwordLockout = passwordLockout;
  }

  static async connect(config: KvstoreAuthLimitsConfig): Promise<KvstoreAuthLimits> {
    const client: RedisClientType = createClient({ url: config.kvstore.url });
    client.on("error", () => {
      // Per-operation fail-open; connection errors surface at consume/get time.
    });
    await client.connect();

    const requestWindowSeconds = Math.max(1, Math.floor(config.rate.windowMs / 1000));
    const lockoutSeconds = Math.max(1, Math.floor(config.lockout.ttl / 1000));

    const requestRateLimiter = new RateLimiterRedis({
      storeClient: client,
      useRedisPackage: true,
      keyPrefix: "ndb:ratelimit:",
      points: config.rate.limit,
      duration: requestWindowSeconds,
    });

    const passwordLockoutLimiter = new RateLimiterRedis({
      storeClient: client,
      useRedisPackage: true,
      keyPrefix: "ndb:pwdlock:",
      points: config.lockout.maxFailures,
      duration: lockoutSeconds,
      blockDuration: lockoutSeconds,
    });

    return new KvstoreAuthLimits(
      createRequestRateLimiter(requestRateLimiter, config.logger),
      createPasswordLockout(passwordLockoutLimiter, config.logger),
      async () => {
        await client.quit();
      }
    );
  }

  async close(): Promise<void> {
    await this.disconnect();
  }
}
