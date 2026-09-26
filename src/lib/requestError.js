/** A network failure with enough structure for the UI to show the right state. */
export class RequestError extends Error {
  constructor(message, { status = 0, retryAfterSeconds = null } = {}) {
    super(message)
    this.name = 'RequestError'
    this.status = status
    this.kind = status === 429 ? 'rate-limit' : 'api'
    this.retryAfterSeconds = retryAfterSeconds
  }
}

export async function responseError(response, fallback) {
  let payload = null
  try {
    payload = await response.json()
  } catch {
    // Gateways and platform failures sometimes return HTML or an empty body.
  }
  const retryAfter = Number(response.headers.get('retry-after'))
  return new RequestError(payload?.error ?? fallback, {
    status: response.status,
    retryAfterSeconds: Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : null,
  })
}
