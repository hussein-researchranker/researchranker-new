import { Redis } from "@upstash/redis";

let redisClient: Redis | null = null;

type RedisHealth = {
  configured: boolean;
  ok: boolean;
};

function getRedisCredentials() {
  const url =
    process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || "";
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    process.env.KV_REST_API_TOKEN ||
    "";

  return {
    url: url.trim(),
    token: token.trim(),
  };
}

export function hasRedisConfiguration() {
  const { url, token } = getRedisCredentials();
  return Boolean(url && token);
}

function getRedisClient() {
  const { url, token } = getRedisCredentials();

  if (!url || !token) {
    throw new Error(
      "Missing Redis environment variables. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN (preferred), or the legacy KV_REST_API_URL and KV_REST_API_TOKEN names."
    );
  }

  if (!redisClient) {
    redisClient = new Redis({
      url,
      token,
    });
  }

  return redisClient;
}

export async function checkRedisHealth(): Promise<RedisHealth> {
  if (!hasRedisConfiguration()) {
    return { configured: false, ok: false };
  }

  try {
    const pong = await getRedisClient().ping();
    return {
      configured: true,
      ok: String(pong).toUpperCase() === "PONG",
    };
  } catch {
    return { configured: true, ok: false };
  }
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