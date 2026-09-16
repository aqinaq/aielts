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
  const [isRecording, setIsRecording] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const [elapsedMs, setElapsedMs] = useState(0)

  const recorderRef = useRef(null)
  const streamRef = useRef(null)
  const urlRef = useRef(null)
  // MediaRecorder finishes asynchronously: `stop()` returns immediately and the
  // blob only exists once `onstop` fires. Callers that stop a recording and
  // immediately submit it would otherwise read the previous turn's audio, or
  // nothing at all — so `stop()` hands back a promise these two settle.
  const blobRef = useRef(null)
  const waitersRef = useRef(new Map())
  const generationRef = useRef(0)
  const startedAtRef = useRef(null)
  const startingRef = useRef(false)
  const recordingRef = useRef(false)

  useEffect(() => {
    if (!isRecording) return undefined
    const interval = setInterval(() => {
      if (startedAtRef.current) setElapsedMs(Date.now() - startedAtRef.current)
    }, 500)
    return () => clearInterval(interval)
  }, [isRecording])

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

  const settle = useCallback((generation, blob) => {
    const waiters = waitersRef.current.get(generation) ?? []
    waitersRef.current.delete(generation)
    waiters.forEach((resolve) => resolve(blob))
  }, [])

  const start = useCallback(async () => {
    if (!isSupported || startingRef.current || recordingRef.current) return false
    setError(null)
    startingRef.current = true
    setIsStarting(true)

    // Every recording carries the generation it began in. `reset` bumps the
    // counter, so a recording that finishes after being discarded can tell that
    // it is stale and drop itself instead of overwriting the cleared state.
    generationRef.current += 1
    const generation = generationRef.current

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (generation !== generationRef.current) {
        stream.getTracks().forEach((track) => track.stop())
        return false
      }
      streamRef.current = stream

      const mimeType = pickMimeType()
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      const chunks = []

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data)
      }

      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop())
        if (streamRef.current === stream) streamRef.current = null
        if (recorderRef.current?.recorder === recorder) recorderRef.current = null

        if (generation !== generationRef.current) {
          settle(generation, null)
          return
        }

        recordingRef.current = false
        setIsRecording(false)
        if (startedAtRef.current) {
          setElapsedMs(Date.now() - startedAtRef.current)
          startedAtRef.current = null
        }

        const blob = new Blob(chunks, {
          type: mimeType || 'audio/webm',
        })
        releaseUrl()
        const url = URL.createObjectURL(blob)
        urlRef.current = url
        blobRef.current = blob
        setAudioUrl(url)
        setAudioBlob(blob)
        settle(generation, blob)
      }

      recorder.start()
      recorderRef.current = { recorder, generation }
      startedAtRef.current = Date.now()
      setElapsedMs(0)
      recordingRef.current = true
      setIsRecording(true)
      return true
    } catch {
      if (generation === generationRef.current) {
        setError('recorderFailed')
        stopStream()
      }
      return false
    } finally {
      if (generation === generationRef.current) {
        startingRef.current = false
        setIsStarting(false)
      }
    }
  }, [isSupported, releaseUrl, settle, stopStream])

  /** Resolves with the finished recording, or the last one if already stopped. */
  const stop = useCallback(() => {
    const active = recorderRef.current
    const recorder = active?.recorder
    if (!recorder) {
      if (startingRef.current) {
        generationRef.current += 1
        startingRef.current = false
        setIsStarting(false)
        return Promise.resolve(null)
      }
      return Promise.resolve(blobRef.current)
    }

    recorderRef.current = null
    recordingRef.current = false
    setIsRecording(false)
    return new Promise((resolve) => {
      const waiters = waitersRef.current.get(active.generation) ?? []
      waiters.push(resolve)
      waitersRef.current.set(active.generation, waiters)
      if (recorder.state !== 'inactive') recorder.stop()
    })
  }, [])

  const reset = useCallback(() => {
    // Bump first: anything still recording is now stale and must not write its
    // blob back over the state cleared just below.
    generationRef.current += 1
    stop()
    startingRef.current = false
    recordingRef.current = false
    startedAtRef.current = null
    setElapsedMs(0)
    setIsStarting(false)
    setIsRecording(false)
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

  return { isSupported, isRecording, isStarting, elapsedMs, audioUrl, audioBlob, error, start, stop, reset }
}
