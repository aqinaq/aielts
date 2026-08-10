import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  MAX_SECONDS,
  TARGET_SAMPLE_RATE,
  encodeWav,
  measureSilence,
} from '../src/lib/audio.js'

const readAscii = (view, offset, length) =>
  String.fromCharCode(
    ...Array.from({ length }, (_, i) => view.getUint8(offset + i)),
  )

/** Alternating loud and quiet stretches, in seconds. */
function buildSignal(segments, sampleRate = TARGET_SAMPLE_RATE) {
  const samples = []
  for (const { seconds, amplitude } of segments) {
    const count = Math.round(seconds * sampleRate)
    for (let i = 0; i < count; i += 1) {
      // A tone rather than a constant: rms of a dc offset would read as loud
      // even where a listener hears nothing.
      samples.push(amplitude * Math.sin((2 * Math.PI * 220 * i) / sampleRate))
    }
  }
  return Float32Array.from(samples)
}

describe('encodeWav', () => {
  it('writes a header the decoders actually look at', () => {
    const samples = Float32Array.from([0, 0.5, -0.5])
    const view = new DataView(encodeWav(samples, 16000))

    assert.equal(readAscii(view, 0, 4), 'RIFF')
    assert.equal(readAscii(view, 8, 4), 'WAVE')
    assert.equal(readAscii(view, 12, 4), 'fmt ')
    assert.equal(readAscii(view, 36, 4), 'data')

    assert.equal(view.getUint16(20, true), 1, 'uncompressed pcm')
    assert.equal(view.getUint16(22, true), 1, 'mono')
    assert.equal(view.getUint32(24, true), 16000, 'sample rate')
    assert.equal(view.getUint32(28, true), 32000, 'byte rate is rate x block align')
    assert.equal(view.getUint16(34, true), 16, 'bit depth')
  })

  it('declares sizes that match the bytes actually written', () => {
    const samples = new Float32Array(100)
    const buffer = encodeWav(samples, 16000)
    const view = new DataView(buffer)

    assert.equal(buffer.byteLength, 44 + 200)
    assert.equal(view.getUint32(40, true), 200, 'data chunk length')
    assert.equal(view.getUint32(4, true), buffer.byteLength - 8, 'riff chunk length')
  })

  it('clamps out-of-range samples instead of wrapping them into clicks', () => {
    // decodeAudioData can hand back values slightly outside [-1, 1]; a wrapped
    // int16 would turn the loudest moment of the answer into a crack.
    const view = new DataView(encodeWav(Float32Array.from([2, -2]), 16000))
    assert.equal(view.getInt16(44, true), 32767)
    assert.equal(view.getInt16(46, true), -32768)
  })

  it('keeps a full-length recording inside the upload budget', () => {
    const bytes = 44 + MAX_SECONDS * TARGET_SAMPLE_RATE * 2
    assert.ok(bytes < 4.5 * 1024 * 1024, 'must fit Vercel body limit')
    assert.ok(MAX_SECONDS >= 120, 'must cover a two-minute Part 2 answer')
  })
})

describe('measureSilence', () => {
  it('finds a long pause between two bursts of speech', () => {
    const samples = buildSignal([
      { seconds: 2, amplitude: 0.5 },
      { seconds: 4, amplitude: 0.0005 },
      { seconds: 2, amplitude: 0.5 },
    ])
    const result = measureSilence(samples)

    assert.equal(result.longPauses, 1)
    assert.ok(
      Math.abs(result.longestPauseMs - 4000) < 200,
      `expected ~4000ms, got ${result.longestPauseMs}`,
    )
  })

  it('ignores gaps shorter than the three-second threshold', () => {
    const samples = buildSignal([
      { seconds: 2, amplitude: 0.5 },
      { seconds: 1, amplitude: 0.0005 },
      { seconds: 2, amplitude: 0.5 },
    ])
    assert.equal(measureSilence(samples).longPauses, 0)
  })

  it('does not count dead air before and after the answer', () => {
    // Someone who hits record, waits, speaks, then waits before stopping has
    // not hesitated — counting that would punish a slow button press.
    const samples = buildSignal([
      { seconds: 5, amplitude: 0.0005 },
      { seconds: 2, amplitude: 0.5 },
      { seconds: 5, amplitude: 0.0005 },
    ])
    const result = measureSilence(samples)

    assert.equal(result.longPauses, 0)
    assert.equal(result.longestPauseMs, 0)
  })

  it('adapts its threshold to a noisy room', () => {
    // Loud background hiss: an absolute threshold would read the whole
    // recording as speech and report no pauses at all.
    const samples = buildSignal([
      { seconds: 2, amplitude: 0.6 },
      { seconds: 4, amplitude: 0.05 },
      { seconds: 2, amplitude: 0.6 },
    ])
    assert.equal(measureSilence(samples).longPauses, 1)
  })

  it('declines to guess when nothing stands out above the floor', () => {
    const result = measureSilence(buildSignal([{ seconds: 5, amplitude: 0.3 }]))
    assert.equal(result.longPauses, 0)
    assert.equal(result.speechRatio, null, 'no dynamic range means no ratio')
  })

  it('survives a recording too short to frame', () => {
    assert.equal(measureSilence(new Float32Array(10)).longPauses, 0)
  })

  it('reports the share of the answer actually spent speaking', () => {
    const samples = buildSignal([
      { seconds: 3, amplitude: 0.5 },
      { seconds: 3, amplitude: 0.0005 },
      { seconds: 3, amplitude: 0.5 },
    ])
    const { speechRatio } = measureSilence(samples)
    assert.ok(speechRatio > 0.55 && speechRatio < 0.78, `got ${speechRatio}`)
  })
})
