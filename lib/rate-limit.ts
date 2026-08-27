import { redis } from "@/lib/redis";

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

function checkMemoryRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): RateLimitResult {
  const now = Date.now();
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

    return {
      success: count <= limit,
      limit,
      remaining: Math.max(limit - count, 0),
      resetAt: Date.now() + retryAfterSeconds * 1000,
      retryAfterSeconds,
    };
  } catch (error) {
    console.error(
      "Redis rate limiter unavailable; using in-memory fallback:",
      error
    );

    return checkMemoryRateLimit(namespacedKey, limit, windowSeconds);
  }
}
