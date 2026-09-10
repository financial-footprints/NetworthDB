export interface RateLimiter {
  allow(key: string): Promise<boolean>;
}
