import { useCallback, useEffect, useRef, useState } from 'react'

// Safari has no webm encoder; everything else prefers it.
const CANDIDATE_TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']

const pickMimeType = () => {
  if (typeof MediaRecorder === 'undefined') return null
  return CANDIDATE_TYPES.find((type) => MediaRecorder.isTypeSupported(type)) ?? ''
}

/**
 * Records the microphone alongside speech recognition so the learner can play
 * their answer back — hearing yourself is most of the value of speaking practice,
 * and the transcript alone throws it away.
 *
 * The recording lives in memory only: it is never stored, and is gone on reload.
 * That keeps audio out of localStorage (far too large) and out of the database,
 * where it would be a privacy liability nobody asked for. It is sent to the
 * speech endpoint when an analysis runs — for that request only, never retained.
 */
export function useAudioRecorder() {
  const [isSupported] = useState(
    () => typeof MediaRecorder !== 'undefined' && Boolean(navigator.mediaDevices),
  )
  const [audioUrl, setAudioUrl] = useState(null)
  // The blob is what gets analyzed; the url is only for the playback element.
  const [audioBlob, setAudioBlob] = useState(null)
  const [error, setError] = useState(null)

  const recorderRef = useRef(null)
  const chunksRef = useRef([])
  const streamRef = useRef(null)
  const urlRef = useRef(null)
  // MediaRecorder finishes asynchronously: `stop()` returns immediately and the
  // blob only exists once `onstop` fires. Callers that stop a recording and
  // immediately submit it would otherwise read the previous turn's audio, or
  // nothing at all — so `stop()` hands back a promise these two settle.
  const blobRef = useRef(null)
  const waitersRef = useRef([])
  const generationRef = useRef(0)

  const releaseUrl = useCallback(() => {
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current)
      urlRef.current = null
    }
  }, [])

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }, [])

  const settle = useCallback((blob) => {
    const waiters = waitersRef.current
    waitersRef.current = []
    waiters.forEach((resolve) => resolve(blob))
  }, [])

  const start = useCallback(async () => {
    if (!isSupported) return
    setError(null)

    // Every recording carries the generation it began in. `reset` bumps the
    // counter, so a recording that finishes after being discarded can tell that
    // it is stale and drop itself instead of overwriting the cleared state.
    generationRef.current += 1
    const generation = generationRef.current

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const mimeType = pickMimeType()
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      chunksRef.current = []

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }

      recorder.onstop = () => {
        stopStream()

        if (generation !== generationRef.current) {
          settle(null)
          return
        }

        const blob = new Blob(chunksRef.current, {
          type: mimeType || 'audio/webm',
        })
        releaseUrl()
        const url = URL.createObjectURL(blob)
        urlRef.current = url
        blobRef.current = blob
        setAudioUrl(url)
        setAudioBlob(blob)
        settle(blob)
      }

      recorder.start()
      recorderRef.current = recorder
    } catch {
      // Permission denial is already reported by the speech hook; don't show
      // the same problem twice.
      setError('recorderFailed')
      stopStream()
    }
  }, [isSupported, releaseUrl, settle, stopStream])

  /** Resolves with the finished recording, or the last one if already stopped. */
  const stop = useCallback(() => {
    const recorder = recorderRef.current
    if (!recorder || recorder.state === 'inactive') {
      return Promise.resolve(blobRef.current)
    }

    recorderRef.current = null
    return new Promise((resolve) => {
      waitersRef.current.push(resolve)
      recorder.stop()
    })
  }, [])

  const reset = useCallback(() => {
    // Bump first: anything still recording is now stale and must not write its
    // blob back over the state cleared just below.
    generationRef.current += 1
    stop()
    releaseUrl()
    blobRef.current = null
    setAudioUrl(null)
    setAudioBlob(null)
    setError(null)
  }, [releaseUrl, stop])

  useEffect(
    () => () => {
      releaseUrl()
      stopStream()
    },
    [releaseUrl, stopStream],
  )

  return { isSupported, audioUrl, audioBlob, error, start, stop, reset }
}
