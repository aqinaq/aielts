import { useCallback, useState } from 'react'

import { DEFAULT_SCOPE, buildContext, isComplete, stageAt } from '../lib/interview'

/**
 * Runs one Speaking test: holds the turns taken so far and fetches the
 * examiner's next line.
 *
 * The plan itself lives in `lib/interview.js` and is pure; this hook is only
 * the part that has to touch the network and React state. It deliberately does
 * not own the microphone — App already wires the recorder and the recognizer
 * for the other modes, and a second owner would fight it for the same stream.
 *
 * `status` drives the whole UI:
 *   idle      nothing started yet
 *   asking    waiting for the examiner's next question
 *   answering a question is on screen; the candidate is speaking
 *   failed    the next question failed; the existing turns can be retried
 *   finished  every turn taken, ready to be graded
 */
export function useInterview(lang) {
  const [turns, setTurns] = useState([])
  const [current, setCurrent] = useState(null)
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)
  const [scope, setScope] = useState(DEFAULT_SCOPE)

  const fetchQuestion = useCallback(
    async (history, activeScope) => {
      const stage = stageAt(history.length, activeScope)
      if (!stage) {
        setCurrent(null)
        setStatus('finished')
        return
      }

      setStatus('asking')
      setError(null)
      setCurrent(null)

      try {
        const response = await fetch('/api/interview', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            part: stage.part,
            kind: stage.kind,
            context: buildContext(history),
            lang,
          }),
        })

        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error)

        setCurrent({ ...stage, question: payload.question, bullets: payload.bullets })
        setStatus('answering')
      } catch (requestError) {
        setError(requestError.message)
        // The last question has already been answered. Keep the turns, but
        // never leave that old question available to submit a second time.
        setStatus('failed')
      }
    },
    [lang],
  )

  const start = useCallback(
    (nextScope = DEFAULT_SCOPE) => {
      setTurns([])
      setCurrent(null)
      setScope(nextScope)
      // Passed explicitly rather than read from state: `setScope` has not been
      // applied yet when the first question is requested.
      return fetchQuestion([], nextScope)
    },
    [fetchQuestion],
  )

  /** Files the answer to the question on screen and asks the next one. */
  const submit = useCallback(
    async ({ answer, audioBlob, durationMs }) => {
      if (!current || status !== 'answering') return

      const next = [
        ...turns,
        {
          part: current.part,
          kind: current.kind,
          question: current.question,
          bullets: current.bullets,
          answer: answer ?? '',
          audioBlob: audioBlob ?? null,
          durationMs: durationMs ?? 0,
        },
      ]

      setTurns(next)
      if (isComplete(next, scope)) {
        setCurrent(null)
        setStatus('finished')
        return
      }
      await fetchQuestion(next, scope)
    },
    [current, status, turns, scope, fetchQuestion],
  )

  const retry = useCallback(
    () => {
      if (status === 'failed') return fetchQuestion(turns, scope)
    },
    [fetchQuestion, status, turns, scope],
  )

  const reset = useCallback(() => {
    setTurns([])
    setCurrent(null)
    setStatus('idle')
    setError(null)
    setScope(DEFAULT_SCOPE)
  }, [])

  /** Ends the test early. Whatever was answered still gets graded. */
  const finishEarly = useCallback(() => {
    setCurrent(null)
    setStatus('finished')
  }, [])

  return {
    turns,
    current,
    status,
    error,
    scope,
    start,
    submit,
    retry,
    reset,
    finishEarly,
  }
}
