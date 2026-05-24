export const MAX_REQUESTS_PER_MINUTE = 30;
const KEY_TTL_SECONDS = 120;

export async function checkRateLimit(
  kv: KVNamespace,
  uid: string,
  nowMs: number = Date.now(),
): Promise<boolean> {
  const bucket = Math.floor(nowMs / 60_000);
  const key = `rate:${uid}:${bucket}`;
  const raw = await kv.get(key);
  const count = raw ? Number(raw) : 0;
  if (count >= MAX_REQUESTS_PER_MINUTE) return false;
  await kv.put(key, String(count + 1), { expirationTtl: KEY_TTL_SECONDS });
  return true;
}
