import { Redis } from "@upstash/redis";

let redisClient: Redis | null = null;

function getRedisClient() {
  const redisUrl = process.env.KV_REST_API_URL;
  const redisToken = process.env.KV_REST_API_TOKEN;

  if (!redisUrl || !redisToken) {
    throw new Error(
      "Missing Redis environment variables. Please set KV_REST_API_URL and KV_REST_API_TOKEN."
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