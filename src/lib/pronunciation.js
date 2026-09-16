// Folding the audio pass back into the text analysis.
//
// Two models grade one answer: DeepSeek marks the criteria that can be read off
// a transcript, Gemini marks the one that cannot. Neither has seen the other's
// work, so the overall band has to be recomputed here — DeepSeek averaged three
// criteria and does not know a fourth exists.

import { officialBand } from '../../api/schema.js'

/**
 * Adds the pronunciation criterion and re-averages the overall band.
 *
 * Pronunciation goes last because that is the order the official speaking
 * descriptors list the four criteria in, and the result panel renders them in
 * insertion order.
 *
 * Returns the analysis untouched when there is no pronunciation to add — a
 * failed or skipped audio pass must never damage a perfectly good text result.
 */
export function mergePronunciation(analysis, speech) {
  if (!analysis || !speech?.pronunciation) return analysis

  const criteria = { ...analysis.criteria, pronunciation: speech.pronunciation }

  return {
    ...analysis,
    criteria,
    overall_band: officialBand(criteria, 'speaking'),
    // Kept beside the criterion rather than inside it: these are teaching
    // material for the learner, not evidence for the band.
    mispronounced: speech.mispronounced ?? [],
  }
}

/**
 * Posts wav bytes to the speech endpoint.
 *
 * Sent as a raw body rather than json: base64 would inflate the upload by a
 * third, and the whole request has to fit inside Vercel's 4.5 MB cap.
 */
export async function assessSpeech(wav, lang) {
  const response = await fetch(`/api/speech?lang=${encodeURIComponent(lang)}`, {
    method: 'POST',
    headers: { 'content-type': 'audio/wav' },
    body: wav,
  })

  const payload = await response.json()
  if (!response.ok) throw new Error(payload.error ?? 'speech request failed')
  return payload
}
