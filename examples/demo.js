const { SlidingWindowRateLimiter, InMemoryEvalClient } = require("../dist/index.js");

async function main() {
  const client = new InMemoryEvalClient();
  const limiter = new SlidingWindowRateLimiter({
    client,
    limit: 5,
    windowMs: 3000,
  });

  console.log("Firing 8 requests immediately for user 'alice' (limit 5 per 3000ms):");
  for (let i = 1; i <= 8; i++) {
    const result = await limiter.check("alice");
    console.log(
      `  request ${i}: allowed=${result.allowed} count=${result.count}/${result.limit}` +
        (result.allowed ? "" : ` retryAfterMs=${result.retryAfterMs}`)
    );
  }

  console.log("\nWaiting for the window to fully roll over...");
  await new Promise((r) => setTimeout(r, 3200));

  const after = await limiter.check("alice");
  console.log(`After window rollover: allowed=${after.allowed} count=${after.count}/${after.limit}`);

  console.log("\nA different identifier ('bob') has an independent window:");
  const bob = await limiter.check("bob");
  console.log(`  bob: allowed=${bob.allowed} count=${bob.count}/${bob.limit}`);
}

main();
