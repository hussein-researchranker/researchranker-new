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

export async function checkRateLimit({
  key,
  limit,
  windowSeconds,
}: RateLimitOptions): Promise<RateLimitResult> {
  const namespacedKey = `ratelimit:${key}`;
  const count = await redis.incr(namespacedKey);

  if (count === 1) {
    await redis.expire(namespacedKey, windowSeconds);
  }

  const ttl = await redis.ttl(namespacedKey);
  const retryAfterSeconds = Math.max(ttl > 0 ? ttl : windowSeconds, 1);

  return {
    success: count <= limit,
    limit,
    remaining: Math.max(limit - count, 0),
    resetAt: Date.now() + retryAfterSeconds * 1000,
    retryAfterSeconds,
  };
}
