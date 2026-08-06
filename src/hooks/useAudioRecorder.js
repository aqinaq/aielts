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
 * The recording lives in memory only: it is never uploaded, never stored, and is
 * gone on reload. That keeps audio out of localStorage (far too large) and out of
 * the database, where it would be a privacy liability nobody asked for.
 */
export function useAudioRecorder() {
  const [isSupported] = useState(
    () => typeof MediaRecorder !== 'undefined' && Boolean(navigator.mediaDevices),
  )
  const [audioUrl, setAudioUrl] = useState(null)
  const [error, setError] = useState(null)

  const recorderRef = useRef(null)
  const chunksRef = useRef([])
  const streamRef = useRef(null)
  const urlRef = useRef(null)

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

  const start = useCallback(async () => {
    if (!isSupported) return
    setError(null)

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
        const blob = new Blob(chunksRef.current, {
          type: mimeType || 'audio/webm',
        })
        releaseUrl()
        const url = URL.createObjectURL(blob)
        urlRef.current = url
        setAudioUrl(url)
        stopStream()
      }

      recorder.start()
      recorderRef.current = recorder
    } catch {
      // Permission denial is already reported by the speech hook; don't show
      // the same problem twice.
      setError('recorderFailed')
      stopStream()
    }
  }, [isSupported, releaseUrl, stopStream])

  const stop = useCallback(() => {
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') recorder.stop()
    recorderRef.current = null
  }, [])

  const reset = useCallback(() => {
    stop()
    releaseUrl()
    setAudioUrl(null)
    setError(null)
  }, [releaseUrl, stop])

  useEffect(
    () => () => {
      releaseUrl()
      stopStream()
    },
    [releaseUrl, stopStream],
  )

  return { isSupported, audioUrl, error, start, stop, reset }
}
