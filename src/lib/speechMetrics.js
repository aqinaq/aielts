// Fluency signals computed in the browser.
//
// There are two sources, and they differ in quality. Chrome's recognizer cleans
// up most "um"/"uh" hesitations before they ever reach us and finalizes a phrase
// a beat after the speaker stops, so anything derived from it is an estimate.
// When the audio itself has been decoded, `silence` carries measurements taken
// from the waveform and those win — see `audio.js`. `measured` records which
// happened, so the UI and the prompt can both be honest about it.

const HESITATIONS = ['um', 'uh', 'erm', 'er', 'ah', 'hmm', 'mmm']
const DISCOURSE_FILLERS = ['you know', 'i mean', 'sort of', 'kind of', 'you see']

const LONG_PAUSE_MS = 3000

const countPhrase = (text, phrase) => {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const matches = text.match(new RegExp(`\\b${escaped}\\b`, 'gi'))
  return matches ? matches.length : 0
}

export function computeSpeechMetrics({
  text,
  durationMs,
  chunkTimestamps = [],
  silence = null,
  verbatim = false,
}) {
  const trimmed = text.trim()
  if (!trimmed) return null

  const wordCount = trimmed.split(/\s+/).filter(Boolean).length
  const minutes = durationMs / 60000

  // Below ~6 seconds the rate is dominated by start-up latency, not speech.
  const wordsPerMinute = minutes >= 0.1 ? Math.round(wordCount / minutes) : null

  const breakdown = [...HESITATIONS, ...DISCOURSE_FILLERS]
    .map((phrase) => ({ phrase, count: countPhrase(trimmed, phrase) }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count)

  const fillerCount = breakdown.reduce((total, entry) => total + entry.count, 0)

  // Immediate word repeats: "the the", "I I think".
  const repeats = trimmed.match(/\b(\w+)\s+\1\b/gi)

  let estimatedPauses = 0
  for (let i = 1; i < chunkTimestamps.length; i += 1) {
    if (chunkTimestamps[i] - chunkTimestamps[i - 1] > LONG_PAUSE_MS) estimatedPauses += 1
  }

  return {
    wordCount,
    durationMs,
    wordsPerMinute,
    fillerCount,
    fillerBreakdown: breakdown,
    repeatCount: repeats ? repeats.length : 0,
    longPauses: silence ? silence.longPauses : estimatedPauses,
    longestPauseMs: silence ? silence.longestPauseMs : null,
    speechRatio: silence ? silence.speechRatio : null,
    // Provenance, tracked separately because the two halves can disagree: on
    // Chrome the pauses come from the waveform while the words still come from
    // a recognizer that quietly deletes hesitations. The prompt hedges each on
    // its own, and claiming one flag for both would overstate the fillers.
    measuredPauses: Boolean(silence),
    verbatim,
  }
}

export const formatDuration = (ms) => {
  const totalSeconds = Math.max(0, Math.round(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}
