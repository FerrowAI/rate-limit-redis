# Rate Limit Redis

Redis-backed distributed rate limiter. Scale Ferrow agents globally.

```javascript
const limiter = new RateLimitRedis(redis, { maxRequests: 100 });
if (await limiter.tryConsume(userId)) { /* allow */ }
```

Features: Distributed, sliding window, TTL, Ferrow scaling.
License: MIT
