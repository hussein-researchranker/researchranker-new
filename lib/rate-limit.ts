import { hasRedisConfiguration, redis } from "@/lib/redis";

type RateLimitOptions = {
  key: string;
  limit: number;
  windowSeconds: number;
};

type RateLimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
};

type MemoryWindow = {
  count: number;
  resetAt: number;
};

const memoryRateLimits = new Map<string, MemoryWindow>();
const MEMORY_MAX_ENTRIES = 5_000;
const REDIS_RETRY_DELAY_MS = 30_000;
const REDIS_LOG_THROTTLE_MS = 60_000;

let redisRetryAfter = 0;
let nextRedisErrorLogAt = 0;
let memoryChecksSinceCleanup = 0;

function cleanupMemoryRateLimits(now: number) {
  memoryChecksSinceCleanup += 1;

  if (
    memoryChecksSinceCleanup < 100 &&
    memoryRateLimits.size < MEMORY_MAX_ENTRIES
  ) {
    return;
  }

  memoryChecksSinceCleanup = 0;

  for (const [key, window] of memoryRateLimits) {
    if (window.resetAt <= now) {
      memoryRateLimits.delete(key);
    }
  }

  if (memoryRateLimits.size <= MEMORY_MAX_ENTRIES) return;

  const oldest = [...memoryRateLimits.entries()]
    .sort((a, b) => a[1].resetAt - b[1].resetAt)
    .slice(0, memoryRateLimits.size - MEMORY_MAX_ENTRIES);

  for (const [key] of oldest) {
    memoryRateLimits.delete(key);
  }
}

function checkMemoryRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): RateLimitResult {
  const now = Date.now();
  cleanupMemoryRateLimits(now);

  const existing = memoryRateLimits.get(key);

  let window: MemoryWindow;

  if (!existing || existing.resetAt <= now) {
    window = {
      count: 1,
      resetAt: now + windowSeconds * 1000,
    };
  } else {
    window = {
      count: existing.count + 1,
      resetAt: existing.resetAt,
    };
  }

  memoryRateLimits.set(key, window);

  const retryAfterSeconds = Math.max(
    Math.ceil((window.resetAt - now) / 1000),
    1
  );

  return {
    success: window.count <= limit,
    limit,
    remaining: Math.max(limit - window.count, 0),
    resetAt: window.resetAt,
    retryAfterSeconds,
  };
}

export async function checkRateLimit({
  key,
  limit,
  windowSeconds,
}: RateLimitOptions): Promise<RateLimitResult> {
  const namespacedKey = `ratelimit:${key}`;
  const now = Date.now();

  if (!hasRedisConfiguration() || now < redisRetryAfter) {
    return checkMemoryRateLimit(namespacedKey, limit, windowSeconds);
  }

  try {
    const count = await redis.incr(namespacedKey);

    if (count === 1) {
      await redis.expire(namespacedKey, windowSeconds);
    }

    const ttl = await redis.ttl(namespacedKey);
    const retryAfterSeconds = Math.max(
      ttl > 0 ? ttl : windowSeconds,
      1
    );

    redisRetryAfter = 0;

    return {
      success: count <= limit,
      limit,
      remaining: Math.max(limit - count, 0),
      resetAt: Date.now() + retryAfterSeconds * 1000,
      retryAfterSeconds,
    };
  } catch (error) {
    redisRetryAfter = Date.now() + REDIS_RETRY_DELAY_MS;

    if (Date.now() >= nextRedisErrorLogAt) {
      nextRedisErrorLogAt = Date.now() + REDIS_LOG_THROTTLE_MS;
      console.error(
        "Redis rate limiter unavailable; temporarily using in-memory fallback:",
        error
      );
    }

    return checkMemoryRateLimit(namespacedKey, limit, windowSeconds);
  }
}