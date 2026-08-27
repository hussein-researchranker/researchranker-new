import { Redis } from "@upstash/redis";

let redisClient: Redis | null = null;

function getRedisClient() {
  const redisUrl =
    process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const redisToken =
    process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;

  if (!redisUrl || !redisToken) {
    throw new Error(
      "Missing Redis environment variables. Please set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN."
    );
  }

  if (!redisClient) {
    redisClient = new Redis({
      url: redisUrl,
      token: redisToken,
    });
  }

  return redisClient;
}

export const redis = new Proxy({} as Redis, {
  get(_target, property) {
    const client = getRedisClient();
    const value = client[property as keyof Redis];

    if (typeof value === "function") {
      return value.bind(client);
    }

    return value;
  },
});