// Turning a MediaRecorder blob into something the speech endpoint can accept.
//
// Two constraints shape everything here:
//
//  1. Gemini accepts wav and mp3 reliably and little else. MediaRecorder gives
//     us webm/opus on Chrome and mp4/aac on Safari, and both are rejected, so
//     the browser has to decode and re-encode to wav before upload.
//  2. A Vercel function body caps at 4.5 MB and cannot be raised. 16 kHz mono
//     16-bit pcm is 32 KB/s, which is what MAX_SECONDS below is derived from.
//
// Decoding to raw pcm has a second payoff: pause detection stops being a guess.
// `speechMetrics.js` infers pauses from when the recognizer happened to finalize
// a phrase, which lags real speech; here we can measure the silence directly.

// 16 kHz is the standard rate for speech models — more is bandwidth we would
// spend for nothing, less starts eating consonants.
export const TARGET_SAMPLE_RATE = 16000

const BYTES_PER_SAMPLE = 2
const WAV_HEADER_BYTES = 44

// 4.5 MB is Vercel's hard body limit; the rest is headroom for headers and for
// the multipart-free raw upload. Anything longer is analyzed without audio.
const BODY_LIMIT_BYTES = 4.5 * 1024 * 1024
export const MAX_SECONDS = Math.floor(
  (BODY_LIMIT_BYTES * 0.95 - WAV_HEADER_BYTES) / (TARGET_SAMPLE_RATE * BYTES_PER_SAMPLE),
)

// --- wav encoding -----------------------------------------------------------

/**
 * Wraps mono float samples in a 16-bit pcm wav container.
 *
 * Kept separate from anything browser-shaped so it can be tested in node: given
 * samples in, the bytes out are fully determined.
 */
export function encodeWav(samples, sampleRate = TARGET_SAMPLE_RATE) {
  const buffer = new ArrayBuffer(WAV_HEADER_BYTES + samples.length * BYTES_PER_SAMPLE)
  const view = new DataView(buffer)

  const writeAscii = (offset, text) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i))
  }

  const byteRate = sampleRate * BYTES_PER_SAMPLE
  const dataBytes = samples.length * BYTES_PER_SAMPLE

  writeAscii(0, 'RIFF')
  view.setUint32(4, 36 + dataBytes, true) // everything after this field
  writeAscii(8, 'WAVE')
  writeAscii(12, 'fmt ')
  view.setUint32(16, 16, true) // fmt chunk length
  view.setUint16(20, 1, true) // 1 = uncompressed pcm
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, BYTES_PER_SAMPLE, true) // block align
  view.setUint16(34, 8 * BYTES_PER_SAMPLE, true)
  writeAscii(36, 'data')
  view.setUint32(40, dataBytes, true)

  for (let i = 0; i < samples.length; i += 1) {
    // Clamp before scaling: decoded audio can sit slightly outside [-1, 1] and
    // wrapping the integer would turn a loud peak into a click.
    const clamped = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(
      WAV_HEADER_BYTES + i * BYTES_PER_SAMPLE,
      Math.round(clamped * (clamped < 0 ? 0x8000 : 0x7fff)),
      true,
    )
  }

  return buffer
}

// --- silence measurement ----------------------------------------------------

const FRAME_MS = 20
const LONG_PAUSE_MS = 3000

const percentile = (sorted, fraction) =>
  sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))]

/**
 * Frame energies, one per FRAME_MS window. Root-mean-square rather than peak so
 * a single click does not read as speech.
 */
function frameEnergies(samples, sampleRate) {
  const frameLength = Math.max(1, Math.round((sampleRate * FRAME_MS) / 1000))
  const energies = []

  for (let start = 0; start + frameLength <= samples.length; start += frameLength) {
    let sum = 0
    for (let i = start; i < start + frameLength; i += 1) sum += samples[i] * samples[i]
    energies.push(Math.sqrt(sum / frameLength))
  }

  return energies
}

/**
 * Measures real silence in the recording.
 *
 * The threshold is adaptive because there is no absolute definition of "quiet" —
 * a laptop mic in a noisy room has a far higher floor than a headset. We take a
 * low percentile as the room's noise floor, a high one as speech level, and put
 * the boundary near the bottom of that range.
 *
 * Returns nulls when the recording has no usable dynamic range (all silence, or
 * constant noise), because a made-up number is worse than an absent one.
 */
export function measureSilence(samples, sampleRate = TARGET_SAMPLE_RATE) {
  const empty = {
    longPauses: 0,
    longestPauseMs: 0,
    pausedMs: 0,
    speakingMs: 0,
    speechRatio: null,
  }

  const energies = frameEnergies(samples, sampleRate)
  if (energies.length < 3) return empty

  const sorted = [...energies].sort((a, b) => a - b)
  const floor = percentile(sorted, 0.1)
  const ceiling = percentile(sorted, 0.9)

  // Nothing stands out above the floor: silence, or unbroken noise. Either way
  // we cannot tell speech from background, so we decline to guess.
  if (ceiling < floor * 2 + 1e-4) return { ...empty, speechRatio: null }

  const threshold = floor + 0.15 * (ceiling - floor)
  const loud = energies.map((energy) => energy > threshold)

  // Leading and trailing silence is dead air around the answer, not hesitation
  // inside it — counting it would punish someone for a slow start button.
  const first = loud.indexOf(true)
  const last = loud.lastIndexOf(true)
  if (first === -1) return empty

  let longPauses = 0
  let longestFrames = 0
  let pausedFrames = 0
  let speakingFrames = 0
  let run = 0

  const closeRun = () => {
    if (run === 0) return
    pausedFrames += run
    longestFrames = Math.max(longestFrames, run)
    if (run * FRAME_MS > LONG_PAUSE_MS) longPauses += 1
    run = 0
  }

  for (let i = first; i <= last; i += 1) {
    if (loud[i]) {
      closeRun()
      speakingFrames += 1
    } else {
      run += 1
    }
  }
  closeRun()

  const insideFrames = last - first + 1

  return {
    longPauses,
    longestPauseMs: longestFrames * FRAME_MS,
    pausedMs: pausedFrames * FRAME_MS,
    speakingMs: speakingFrames * FRAME_MS,
    speechRatio: insideFrames > 0 ? speakingFrames / insideFrames : null,
  }
}

// --- browser entry point ----------------------------------------------------

const AudioContextClass = () =>
  typeof window === 'undefined'
    ? null
    : (window.AudioContext ?? window.webkitAudioContext ?? null)

/**
 * Decodes any audio blob — a live recording or an uploaded file — mixes it to
 * mono at TARGET_SAMPLE_RATE and returns wav bytes plus the silence
 * measurements taken from the same samples.
 *
 * Audio longer than MAX_SECONDS is **trimmed to the first MAX_SECONDS** rather
 * than rejected. The limit exists because of an upload cap, not because a long
 * answer is unassessable: pronunciation reads perfectly well off a two-minute
 * sample, and returning something with a clear caveat beats refusing the file.
 * Callers get `trimmed: true` and the real length in `fullDurationMs` so they
 * can say which part was actually heard.
 */
export async function prepareAudio(blob) {
  const Ctor = AudioContextClass()
  if (!Ctor || !blob) return null

  const context = new Ctor()
  let decoded
  try {
    decoded = await context.decodeAudioData(await blob.arrayBuffer())
  } catch {
    // Not audio this browser can decode — a corrupt file, or a format it has
    // no decoder for. The caller reports it rather than crashing the attempt.
    return null
  } finally {
    // Safari leaks the hardware node otherwise.
    context.close?.()
  }

  const trimmed = decoded.duration > MAX_SECONDS
  const usedSeconds = Math.min(decoded.duration, MAX_SECONDS)

  // OfflineAudioContext resamples and downmixes in one pass, and is the only
  // resampler guaranteed to exist in every browser we support. Rendering fewer
  // frames than the source holds is what performs the trim.
  const frames = Math.max(1, Math.ceil(usedSeconds * TARGET_SAMPLE_RATE))
  const offline = new (window.OfflineAudioContext ?? window.webkitOfflineAudioContext)(
    1,
    frames,
    TARGET_SAMPLE_RATE,
  )
  const source = offline.createBufferSource()
  source.buffer = decoded
  source.connect(offline.destination)
  source.start()

  const rendered = await offline.startRendering()
  const samples = rendered.getChannelData(0)

  return {
    trimmed,
    wav: encodeWav(samples, TARGET_SAMPLE_RATE),
    // What was actually sent, and what the source really was. They differ only
    // on a trim, and the caller needs both to explain the gap.
    durationMs: Math.round(usedSeconds * 1000),
    fullDurationMs: Math.round(decoded.duration * 1000),
    silence: measureSilence(samples, TARGET_SAMPLE_RATE),
  }
}
