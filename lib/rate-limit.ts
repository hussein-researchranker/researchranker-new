import { redis } from "@/lib/redis";

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
};

type RateLimitOptions = {
  key: string;
  limit: number;
  windowSeconds: number;
  prefix?: string;
};

export async function checkRateLimit({
  key,
  limit,
  windowSeconds,
  prefix = "rate-limit",
}: RateLimitOptions): Promise<RateLimitResult> {
  const safeLimit = Math.max(1, Math.floor(limit));
  const safeWindowSeconds = Math.max(1, Math.floor(windowSeconds));
  const now = Date.now();
  const windowMs = safeWindowSeconds * 1000;
  const bucket = Math.floor(now / windowMs);
  const redisKey = `${prefix}:${key}:${bucket}`;

  const count = Number(await redis.incr(redisKey));

  if (count === 1) {
    await redis.expire(redisKey, safeWindowSeconds + 5);
  }

  const resetAt = (bucket + 1) * windowMs;
  const retryAfterSeconds = Math.max(1, Math.ceil((resetAt - now) / 1000));

  return {
    allowed: count <= safeLimit,
    limit: safeLimit,
    remaining: Math.max(0, safeLimit - count),
    resetAt,
    retryAfterSeconds,
  };
}

export function rateLimitHeaders(result: RateLimitResult) {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
    "Retry-After": String(result.retryAfterSeconds),
  };
}
