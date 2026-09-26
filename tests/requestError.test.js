import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { responseError } from '../src/lib/requestError.js'

describe('responseError', () => {
  it('preserves rate-limit status and retry timing for the UI', async () => {
    const error = await responseError(new Response(
      JSON.stringify({ error: 'Hourly limit reached.' }),
      { status: 429, headers: { 'content-type': 'application/json', 'retry-after': '120' } },
    ), 'fallback')

    assert.equal(error.kind, 'rate-limit')
    assert.equal(error.status, 429)
    assert.equal(error.retryAfterSeconds, 120)
    assert.equal(error.message, 'Hourly limit reached.')
  })

  it('gives an HTML gateway failure a useful fallback', async () => {
    const error = await responseError(new Response('<h1>Bad gateway</h1>', { status: 502 }), 'Request failed')
    assert.equal(error.kind, 'api')
    assert.equal(error.message, 'Request failed')
  })
})
