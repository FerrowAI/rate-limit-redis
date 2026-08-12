/**
 * Atomic sliding-window rate limit script.
 *
 * KEYS[1] = the sorted-set key for this identifier
 * ARGV[1] = now (ms, integer)
 * ARGV[2] = window size (ms, integer)
 * ARGV[3] = limit (max requests allowed per window)
 * ARGV[4] = unique member id for this request (e.g. `${now}-${random}`)
 *
 * Sorted-set members are unique per-request tokens; scores are timestamps.
 * We trim anything older than the window, count what's left, and only add
 * the new entry if we're still under the limit — all atomically via EVAL.
 *
 * Returns: [allowed (0|1), count_after, retryAfterMs]
 */
export const SLIDING_WINDOW_SCRIPT = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local member = ARGV[4]

redis.call('ZREMRANGEBYSCORE', key, '-inf', now - window)

local count = redis.call('ZCARD', key)

if count < limit then
  redis.call('ZADD', key, now, member)
  redis.call('PEXPIRE', key, window)
  return {1, count + 1, 0}
else
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  local retryAfter = window
  if oldest[2] ~= nil then
    retryAfter = (tonumber(oldest[2]) + window) - now
    if retryAfter < 0 then retryAfter = 0 end
  end
  return {0, count, retryAfter}
end
`;
