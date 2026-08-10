// Orchestrates one attempt across the two models.
//
// The text criteria come from DeepSeek and pronunciation from Gemini, and which
// order they run in depends on what the browser already gave us:
//
//   Chrome  — Web Speech produced a live transcript, so both calls go out at
//             once and the attempt costs one round trip instead of two.
//   Firefox — no Web Speech at all. Gemini has to transcribe before there is
//             anything for DeepSeek to grade, so the calls are sequential.
//     Safari
//
// Either way the audio pass is optional: if it fails, is skipped, or the
// recording is too long to upload, the text analysis still stands and the caller
// is handed a note explaining what is missing. Losing a whole attempt because
// pronunciation could not be marked would be a bad trade.

import { prepareAudio } from './audio.js'
import { assessSpeech, mergePronunciation } from './pronunciation.js'
import { computeSpeechMetrics } from './speechMetrics.js'

const MAX_TEXT_CHARS = 12000
const MAX_TASK_CHARS = 2000

async function analyzeText({ text, task, mode, lang, metrics, hasData }) {
  const response = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text, task, mode, lang, metrics, hasData }),
  })

  const payload = await response.json()
  if (!response.ok) throw new Error(payload.error)
  return payload
}

export async function runAnalysis({
  text,
  task,
  mode,
  lang,
  audioBlob,
  elapsedMs,
  chunkTimestamps,
  // True when <task> carries the figures behind a chart, which lets the grader
  // mark reported numbers instead of only judging how the prose reads.
  hasData = false,
  // An interview grades eleven answers but uploads only the longest one, so the
  // waveform covers a fraction of the words. Pronunciation is still valid from
  // that sample; pause counts and speaking ratio are not, and reporting them as
  // if they described the whole session would understate every silence in it.
  audioCoversAllSpeech = true,
}) {
  const submittedTask = task.trim().slice(0, MAX_TASK_CHARS)
  const recognized = text.trim().slice(0, MAX_TEXT_CHARS)
  const notes = []

  // Decoding happens in the browser and costs no request, so the waveform
  // measurements are available before either model has been asked anything.
  const audio = mode === 'speaking' && audioBlob ? await prepareAudio(audioBlob) : null
  if (mode === 'speaking' && audioBlob && !audio) throw new Error('audioUnreadable')
  if (audio?.trimmed) notes.push('audioTrimmed')

  const wav = audio?.wav ?? null

  /**
   * Whether the waveform covers the same speech the text does.
   *
   * It does when the transcript was produced *from* this audio — then a trim
   * simply moves both ends together. It does not when the text came from
   * somewhere else and runs past the audio: a recording longer than the upload
   * cap, or an interview where only one answer of eleven was sent. Measuring
   * silence over part of an answer and reporting it as the whole would
   * understate every pause in the rest.
   */
  const metricsFor = (body, { verbatim, fromThisAudio }) => {
    if (mode !== 'speaking') return null

    const aligned = fromThisAudio || (audioCoversAllSpeech && !audio?.trimmed)
    return computeSpeechMetrics({
      text: body,
      durationMs: aligned ? (audio?.durationMs ?? elapsedMs) : elapsedMs,
      chunkTimestamps,
      silence: aligned ? (audio?.silence ?? null) : null,
      verbatim,
    })
  }

  // --- no transcript yet: Gemini has to speak first ---
  if (!recognized) {
    if (!wav) throw new Error('noInput')

    const speech = await assessSpeech(wav, lang)
    const transcript = speech.transcript.trim().slice(0, MAX_TEXT_CHARS)
    if (!transcript) throw new Error('noSpeechHeard')

    // Verbatim, because Gemini was asked to keep every hesitation in — so the
    // filler count taken off this text is real rather than an undercount. And
    // the transcript is this audio written down, so the two describe exactly
    // the same stretch of speech even when it was trimmed.
    const metrics = metricsFor(transcript, { verbatim: true, fromThisAudio: true })
    const analysis = await analyzeText({
      text: transcript,
      task: submittedTask,
      mode,
      lang,
      metrics,
      hasData,
    })

    return { data: mergePronunciation(analysis, speech), text: transcript, metrics, notes }
  }

  // --- transcript already on screen: run both at once ---
  //
  // The recognized text is what gets graded even though Gemini's transcript is
  // more accurate, because corrections are highlighted inside the text the user
  // is looking at — grading a different string would leave every quote unable to
  // find its match.
  const metrics = metricsFor(recognized, { verbatim: false, fromThisAudio: false })

  const [analysis, speech] = await Promise.all([
    analyzeText({ text: recognized, task: submittedTask, mode, lang, metrics, hasData }),
    wav
      ? assessSpeech(wav, lang).catch(() => {
          notes.push('pronunciationFailed')
          return null
        })
      : null,
  ])

  return {
    data: speech ? mergePronunciation(analysis, speech) : analysis,
    text: recognized,
    metrics,
    notes,
  }
}
