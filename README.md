# rate-limit-redis
![CI](https://github.com/FerrowAI/rate-limit-redis/actions/workflows/ci.yml/badge.svg)

A distributed sliding-window rate limiter that works over **any** redis
client. Instead of depending on `ioredis` or `node-redis`, it talks to a
minimal `EvalClient` interface — `{ eval(script, keys, args) }` — which
every popular Node redis client already implements (or can be adapted to
in one line). That means zero runtime dependencies, and you don't have to
match a redis client version this library was pinned against.

Ships two things:
1. An atomic Lua script implementing a real sliding window over a redis
   sorted set (`ZREMRANGEBYSCORE` / `ZCARD` / `ZADD` / `PEXPIRE`).
2. An `InMemoryEvalClient` implementing the exact same interface, for
   tests, local dev, or single-process deployments with no redis at all.

## Install

```bash
npm install rate-limit-redis
```

## Quickstart

With `ioredis`:

```ts
import Redis from "ioredis";
import { SlidingWindowRateLimiter } from "rate-limit-redis";

const redis = new Redis();
const limiter = new SlidingWindowRateLimiter({
  client: { eval: (script, keys, args) => redis.eval(script, keys.length, ...keys, ...args) },
  limit: 100,
  windowMs: 60_000,
});

const result = await limiter.check(userId);
if (!result.allowed) {
  res.setHeader("Retry-After", Math.ceil(result.retryAfterMs / 1000));
  return res.status(429).end();
}
```

With no redis at all (tests/dev):

```ts
import { SlidingWindowRateLimiter, InMemoryEvalClient } from "rate-limit-redis";

const limiter = new SlidingWindowRateLimiter({
  client: new InMemoryEvalClient(),
  limit: 5,
  windowMs: 1000,
});
```

## API

### `new SlidingWindowRateLimiter(options)`

| Option | Type | Description |
|---|---|---|
| `client` | `EvalClient` | Anything with `eval(script, keys, args): Promise<any>`. |
| `limit` | `number` | Max requests allowed per window. |
| `windowMs` | `number` | Window size in milliseconds. |
| `keyPrefix` | `string` | Redis key prefix. Default `"rl:"`. |

### `limiter.check(identifier: string): Promise<RateLimitResult>`

```ts
interface RateLimitResult {
  allowed: boolean;
  count: number;       // requests counted in the current window
  limit: number;
  retryAfterMs: number; // 0 if allowed
}
```

### `SLIDING_WINDOW_SCRIPT`

The raw Lua source, exported in case you want to `SCRIPT LOAD` /
`EVALSHA` it yourself instead of going through `EvalClient`.

### `InMemoryEvalClient`

Implements `EvalClient` in-process with a `Map`, reproducing the Lua
script's exact trim/count/add semantics. Has a `.reset()` helper for
tests.

## Design notes

Rate limiting only works if the check-and-increment is atomic — otherwise
concurrent requests can all read "under the limit" and all get through.
A single `EVAL` call gives us that atomicity for free from redis itself,
so the whole algorithm lives in one Lua script rather than multiple
round-trips wrapped in a transaction. Depending on a minimal interface
instead of a specific client library means this works whether you're on
`ioredis`, `node-redis`, a cluster client, or a hand-rolled wrapper — and
the in-memory fallback means your test suite doesn't need a real redis
just to exercise rate-limit logic.

---

Sponsored by [Ferrow](https://ferrow.ai)

---
Part of the [ferrow-toolkit](https://github.com/FerrowAI/ferrow-toolkit) collection · Sponsored by [Ferrow](https://ferrow.ai)
