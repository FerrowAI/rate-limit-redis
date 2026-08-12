import { SLIDING_WINDOW_SCRIPT } from "./lua";

export { SLIDING_WINDOW_SCRIPT } from "./lua";
export { InMemoryEvalClient } from "./memory-store";

/**
 * The minimal interface any redis client needs to satisfy. Every popular
 * Node redis client (`ioredis`, `redis`/`node-redis` v4, `handy-redis`,
 * etc.) already exposes something eval-shaped, or can be adapted to this
 * signature in one line — so this library never depends on a specific one.
 */
export interface EvalClient {
  eval(script: string, keys: string[], args: (string | number)[]): Promise<any>;
}

export interface RateLimitOptions {
  /** Any client implementing the minimal EvalClient interface. */
  client: EvalClient;
  /** Max requests allowed per window. */
  limit: number;
  /** Window size in milliseconds. */
  windowMs: number;
  /** Prefix for the redis keys this limiter creates. Default "rl:". */
  keyPrefix?: string;
}

export interface RateLimitResult {
  /** Whether this request is allowed. */
  allowed: boolean;
  /** Requests counted in the current window (including this one, if allowed). */
  count: number;
  /** Configured limit. */
  limit: number;
  /** Ms until the caller may retry, if not allowed (0 if allowed). */
  retryAfterMs: number;
}

let counter = 0;
function uniqueMember(): string {
  counter = (counter + 1) % Number.MAX_SAFE_INTEGER;
  return `${Date.now()}-${counter}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Distributed sliding-window rate limiter. Atomic per-check via a single
 * EVAL call, so concurrent requests across processes/hosts sharing the
 * same redis (or the in-memory fallback) can't race past the limit.
 */
export class SlidingWindowRateLimiter {
  private client: EvalClient;
  private limit: number;
  private windowMs: number;
  private keyPrefix: string;

  constructor(options: RateLimitOptions) {
    if (!options?.client) throw new Error("RateLimitOptions.client is required");
    if (!(options.limit > 0)) throw new Error("RateLimitOptions.limit must be > 0");
    if (!(options.windowMs > 0)) throw new Error("RateLimitOptions.windowMs must be > 0");
    this.client = options.client;
    this.limit = options.limit;
    this.windowMs = options.windowMs;
    this.keyPrefix = options.keyPrefix ?? "rl:";
  }

  /**
   * Check (and record, if allowed) one request for `identifier`
   * (e.g. an IP, API key, or user id).
   */
  async check(identifier: string): Promise<RateLimitResult> {
    const key = `${this.keyPrefix}${identifier}`;
    const now = Date.now();
    const member = uniqueMember();
    const [allowedFlag, count, retryAfterMs] = await this.client.eval(
      SLIDING_WINDOW_SCRIPT,
      [key],
      [now, this.windowMs, this.limit, member]
    );
    return {
      allowed: Number(allowedFlag) === 1,
      count: Number(count),
      limit: this.limit,
      retryAfterMs: Number(retryAfterMs),
    };
  }
}

export default SlidingWindowRateLimiter;
