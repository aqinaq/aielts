import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { LIMITS, checkRateLimit, resetRateLimits } from '../api/rateLimit.js'

const redisEnv = {
  UPSTASH_REDIS_REST_URL: 'https://example.upstash.io/',
  UPSTASH_REDIS_REST_TOKEN: 'test-token',
  VERCEL: '1',
}

describe('shared rate limit', () => {
  it('fails closed on Vercel when Redis has not been configured', async () => {
    const result = await checkRateLimit('analyze', '127.0.0.1', { env: { VERCEL: '1' } })
    assert.deepEqual(result, { allowed: false, configurationError: true })
  })

  it('rejects non-HTTPS Redis configuration', async () => {
    const result = await checkRateLimit('analyze', '127.0.0.1', {
      env: { ...redisEnv, UPSTASH_REDIS_REST_URL: 'http://example.upstash.io' },
    })
    assert.deepEqual(result, { allowed: false, configurationError: true })
  })

  it('uses one atomic Redis counter for every instance and does not store a raw IP', async () => {
    const calls = []
    let count = 0
    const fetchImpl = async (url, options) => {
      calls.push({ url, options })
      count += 1
      return { ok: true, json: async () => [{ result: count }, { result: 1 }] }
    }
    for (let index = 0; index < LIMITS.analyze; index += 1) {
      const result = await checkRateLimit('analyze', '203.0.113.5', {
        now: 5 * 60 * 1000,
        env: redisEnv,
        fetchImpl,
      })
      assert.deepEqual(result, { allowed: true })
    }
    const blocked = await checkRateLimit('analyze', '203.0.113.5', {
      now: 5 * 60 * 1000,
      env: redisEnv,
      fetchImpl,
    })
    assert.deepEqual(blocked, { allowed: false, retryAfterMinutes: 55 })
    const keys = calls.map((call) => JSON.parse(call.options.body)[0][1])
    assert.equal(new Set(keys).size, 1)
    assert.ok(!keys[0].includes('203.0.113.5'))
    assert.ok(calls.every((call) => call.url.endsWith('/multi-exec')))
  })

  it('does not allow paid AI calls when the shared store fails', async () => {
    const result = await checkRateLimit('speech', '203.0.113.5', {
      env: redisEnv,
      fetchImpl: async () => { throw new Error('offline') },
    })
    assert.deepEqual(result, { allowed: false, backendError: true })
  })

  it('retains an isolated in-memory fallback for local development', async () => {
    resetRateLimits()
    for (let index = 0; index < LIMITS.analyze; index += 1) {
      assert.deepEqual(await checkRateLimit('analyze', 'local-test', { now: 0, env: {} }), { allowed: true })
    }
    const blocked = await checkRateLimit('analyze', 'local-test', { now: 0, env: {} })
    assert.deepEqual(blocked, { allowed: false, retryAfterMinutes: 60 })
    resetRateLimits()
  })
})
