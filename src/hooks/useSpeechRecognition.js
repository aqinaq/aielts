import { useCallback, useEffect, useRef, useState } from 'react'

const getSpeechRecognition = () => {
  if (typeof window === 'undefined') return null
  return window.SpeechRecognition || window.webkitSpeechRecognition || null
}

// Web Speech API error names -> i18n keys under `errors.*`.
const ERROR_CODES = {
  'not-allowed': 'notAllowed',
  'service-not-allowed': 'serviceNotAllowed',
  'audio-capture': 'audioCapture',
  network: 'network',
  'language-not-supported': 'languageNotSupported',
}

/**
 * Speech-to-text on top of the browser's Web Speech API.
 *
 * Finalized chunks are handed to `onResult` instead of being stored here, so the
 * caller keeps a single source of truth for the text and the user can still edit
 * it by hand. Interim (not-yet-final) words are exposed separately for display.
 *
 * The hook also times the session and records when each chunk was finalized, so
 * fluency metrics (speaking rate, pauses) can be derived from it.
 *
 * `error` is an i18n key, not a message — the UI translates it.
 */
export function useSpeechRecognition({ lang = 'en-US', onResult } = {}) {
  const SpeechRecognition = getSpeechRecognition()
  const isSupported = Boolean(SpeechRecognition)

  const [isListening, setIsListening] = useState(false)
  const [interimTranscript, setInterimTranscript] = useState('')
  const [error, setError] = useState(null)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [chunkTimestamps, setChunkTimestamps] = useState([])

  const recognitionRef = useRef(null)
  // Chrome ends recognition after a pause even with `continuous: true`, so we
  // track intent separately and restart until the user actually stops.
  const shouldListenRef = useRef(false)
  const onResultRef = useRef(onResult)
  // Wall-clock timing across every start/stop leg of one recording session.
  const legStartedAtRef = useRef(null)
  const accumulatedMsRef = useRef(0)

  useEffect(() => {
    onResultRef.current = onResult
  }, [onResult])

  useEffect(() => {
    if (!isSupported) return undefined

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = lang

    recognition.onresult = (event) => {
      let interim = ''
      let final = ''

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i]
        if (result.isFinal) final += result[0].transcript
        else interim += result[0].transcript
      }

      if (final.trim()) {
        onResultRef.current?.(final.trim())
        setChunkTimestamps((current) => [...current, Date.now()])
      }
      setInterimTranscript(interim)
    }

    recognition.onerror = (event) => {
      // `no-speech` fires on silence and `aborted` on our own stop() — neither
      // is worth surfacing; onend restarts the session if we still want it.
      if (event.error === 'no-speech' || event.error === 'aborted') return
      shouldListenRef.current = false
      setIsListening(false)
      setError(ERROR_CODES[event.error] ?? 'unknown')
    }

    recognition.onend = () => {
      setInterimTranscript('')
      if (!shouldListenRef.current) {
        setIsListening(false)
        return
      }
      try {
        recognition.start()
      } catch {
        shouldListenRef.current = false
        setIsListening(false)
      }
    }

    recognitionRef.current = recognition

    return () => {
      shouldListenRef.current = false
      recognition.onresult = null
      recognition.onerror = null
      recognition.onend = null
      try {
        recognition.stop()
      } catch {
        /* never started */
      }
      recognitionRef.current = null
      setIsListening(false)
      setInterimTranscript('')
    }
  }, [SpeechRecognition, isSupported, lang])

  // Keep the on-screen timer moving while recording.
  useEffect(() => {
    if (!isListening) return undefined
    const interval = setInterval(() => {
      setElapsedMs(
        accumulatedMsRef.current +
          (legStartedAtRef.current ? Date.now() - legStartedAtRef.current : 0),
      )
    }, 500)
    return () => clearInterval(interval)
  }, [isListening])

  const startListening = useCallback(() => {
    const recognition = recognitionRef.current
    if (!recognition || shouldListenRef.current) return

    setError(null)
    shouldListenRef.current = true
    try {
      recognition.start()
      legStartedAtRef.current = Date.now()
      setIsListening(true)
    } catch {
      // Thrown when a previous session hasn't fully released the mic yet.
      shouldListenRef.current = false
      setError('startFailed')
    }
  }, [])

  const stopListening = useCallback(() => {
    shouldListenRef.current = false
    try {
      recognitionRef.current?.stop()
    } catch {
      /* already stopped */
    }
    if (legStartedAtRef.current) {
      accumulatedMsRef.current += Date.now() - legStartedAtRef.current
      legStartedAtRef.current = null
      setElapsedMs(accumulatedMsRef.current)
    }
    setIsListening(false)
    setInterimTranscript('')
  }, [])

  const toggleListening = useCallback(() => {
    if (shouldListenRef.current) stopListening()
    else startListening()
  }, [startListening, stopListening])

  /** Drop the timing data — call whenever the transcript itself is discarded. */
  const resetSession = useCallback(() => {
    accumulatedMsRef.current = 0
    legStartedAtRef.current = null
    setElapsedMs(0)
    setChunkTimestamps([])
  }, [])

  return {
    isSupported,
    isListening,
    interimTranscript,
    error,
    elapsedMs,
    chunkTimestamps,
    startListening,
    stopListening,
    toggleListening,
    resetSession,
  }
}
