// Shared hourly counters for public deployments. Each clock-hour counter is
// visible to every function instance. The Map is only a development fallback;
// production refuses paid AI calls when the shared store is not configured.

import { createHash } from 'node:crypto'

const WINDOW_MS = 60 * 60 * 1000
const REDIS_TTL_SECONDS = 2 * 60 * 60
const readLimit = (value, fallback) => {
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback
}

export const LIMITS = {
  analyze: readLimit(process.env.RATE_LIMIT_PER_HOUR, 10),
  speech: readLimit(process.env.SPEECH_RATE_LIMIT_PER_HOUR, 20),
  interview: readLimit(process.env.INTERVIEW_RATE_LIMIT_PER_HOUR, 80),
}

const requestLog = new Map()

function localLimit(bucket, ip, now, limit) {
  const key = `${bucket}:${ip}`
  const recent = (requestLog.get(key) ?? []).filter((at) => now - at < WINDOW_MS)
  if (recent.length >= limit) {
    return {
      allowed: false,
      retryAfterMinutes: Math.ceil((WINDOW_MS - (now - recent[0])) / 60000),
    }
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

export async function checkRateLimit(bucket, ip, {
  now = Date.now(),
  env = process.env,
  fetchImpl = fetch,
} = {}) {
  const limit = LIMITS[bucket] ?? 10
  const url = env.UPSTASH_REDIS_REST_URL
  const token = env.UPSTASH_REDIS_REST_TOKEN

  if (!url || !token) {
    if (env.VERCEL === '1' || env.REQUIRE_SHARED_RATE_LIMIT === 'true' || url || token) {
      return { allowed: false, configurationError: true }
    }
    return localLimit(bucket, ip, now, limit)
  }
  if (!/^https:\/\//i.test(url)) return { allowed: false, configurationError: true }

  try {
    const windowId = Math.floor(now / WINDOW_MS)
    const identity = createHash('sha256').update(ip).digest('hex').slice(0, 32)
    const key = `aielts:rate:${bucket}:${windowId}:${identity}`
    const response = await fetchImpl(`${url.replace(/\/$/, '')}/multi-exec`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify([
        ['INCR', key],
        ['EXPIRE', key, REDIS_TTL_SECONDS],
      ]),
      signal: AbortSignal.timeout(3000),
    })
    if (!response.ok) throw new Error(`Redis returned ${response.status}`)
    const payload = await response.json()
    const count = Number(payload?.[0]?.result)
    if (!Array.isArray(payload) || payload[0]?.error || payload[1]?.error ||
      payload[0]?.result == null || !Number.isSafeInteger(count) || count < 1 ||
      payload[1]?.result !== 1) {
      throw new Error('Redis returned an invalid counter response')
    }
    if (count > limit) {
      return {
        allowed: false,
        retryAfterMinutes: Math.ceil(((windowId + 1) * WINDOW_MS - now) / 60000),
      }
    }
    return { allowed: true }
  } catch (error) {
    console.error('[rateLimit] shared counter unavailable:', error.message)
    return { allowed: false, backendError: true }
  }
}

export const clientIp = (req) =>
  (process.env.VERCEL === '1'
    ? req.headers['x-vercel-forwarded-for'] || req.headers['x-forwarded-for']
    : req.socket?.remoteAddress || req.headers['x-real-ip']) || 'unknown'

/** Test seam for the development fallback. */
export const resetRateLimits = () => requestLog.clear()
