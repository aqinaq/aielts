// Best-effort abuse guard, shared by every endpoint that spends money.
//
// Serverless instances are ephemeral and there can be several at once, so this
// caps casual abuse, not a determined attacker — put a shared store (Vercel KV,
// Upstash) behind `checkRateLimit` if the deployment is public.
//
// Buckets are named so that one expensive call cannot exhaust another's budget:
// a long recording and a text analysis are priced very differently.

const WINDOW_MS = 60 * 60 * 1000

export const LIMITS = {
  analyze: Number(process.env.RATE_LIMIT_PER_HOUR ?? 10),
  speech: Number(process.env.SPEECH_RATE_LIMIT_PER_HOUR ?? 20),
  // One interview spends a dozen of these, so the ceiling is much higher —
  // they are short, cheap calls next to a grading pass.
  interview: Number(process.env.INTERVIEW_RATE_LIMIT_PER_HOUR ?? 80),
}

const requestLog = new Map()

export function checkRateLimit(bucket, ip) {
  const key = `${bucket}:${ip}`
  const now = Date.now()
  const limit = LIMITS[bucket] ?? 10
  const recent = (requestLog.get(key) ?? []).filter((at) => now - at < WINDOW_MS)

  if (recent.length >= limit) {
    const retryAfterMs = WINDOW_MS - (now - recent[0])
    return { allowed: false, retryAfterMinutes: Math.ceil(retryAfterMs / 60000) }
  }

  recent.push(now)
  requestLog.set(key, recent)

  if (requestLog.size > 5000) {
    for (const [entry, timestamps] of requestLog) {
      if (timestamps.every((at) => now - at >= WINDOW_MS)) requestLog.delete(entry)
    }
  }

  return { allowed: true }
}

export const clientIp = (req) =>
  req.headers['x-forwarded-for']?.split(',')[0].trim() ||
  req.headers['x-real-ip'] ||
  req.socket?.remoteAddress ||
  'unknown'

/** Test seam — the log is module state that would otherwise leak between cases. */
export const resetRateLimits = () => requestLog.clear()
