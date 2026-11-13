const hits = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  key: string,
  maxRequests = 15,
  windowMs = 60_000
): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const record = hits.get(key);

  if (!record || now > record.resetAt) {
    hits.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1 };
  }

  if (record.count >= maxRequests) {
    return { allowed: false, remaining: 0 };
  }

  record.count += 1;
  return { allowed: true, remaining: maxRequests - record.count };
}