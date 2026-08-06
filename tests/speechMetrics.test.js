import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { computeSpeechMetrics, formatDuration } from '../src/lib/speechMetrics.js'

const transcript =
  'um I think that you know the the city is very nice and I mean people are friendly uh yes'

describe('computeSpeechMetrics', () => {
  const metrics = computeSpeechMetrics({
    text: transcript,
    durationMs: 30_000,
    chunkTimestamps: [0, 1000, 5000, 9500, 9800],
  })

  it('counts words and derives the speaking rate', () => {
    assert.equal(metrics.wordCount, 20)
    assert.equal(metrics.wordsPerMinute, 40) // 20 words in half a minute
  })

  it('finds hesitations and multi-word discourse fillers', () => {
    assert.equal(metrics.fillerCount, 4) // um, uh, "you know", "i mean"
    const phrases = metrics.fillerBreakdown.map((entry) => entry.phrase)
    assert.ok(phrases.includes('you know'))
    assert.ok(phrases.includes('i mean'))
  })

  it('does not count words that merely contain a filler', () => {
    // "number" contains "um"; a substring match would report a filler here.
    const clean = computeSpeechMetrics({
      text: 'the number of umbrellas here is uhh not relevant',
      durationMs: 10_000,
      chunkTimestamps: [],
    })
    assert.equal(clean.fillerCount, 0)
  })

  it('catches immediate word repetitions', () => {
    assert.equal(metrics.repeatCount, 1) // "the the"
  })

  it('counts gaps over three seconds as long pauses', () => {
    // gaps: 1000, 4000, 4500, 300 -> two are over 3s
    assert.equal(metrics.longPauses, 2)
  })

  it('returns null for an empty transcript instead of dividing by zero', () => {
    assert.equal(
      computeSpeechMetrics({ text: '   ', durationMs: 1000, chunkTimestamps: [] }),
      null,
    )
  })

  it('withholds a rate when the clip is too short to be meaningful', () => {
    const short = computeSpeechMetrics({
      text: 'hello there',
      durationMs: 3000,
      chunkTimestamps: [],
    })
    assert.equal(short.wordsPerMinute, null)
    assert.equal(short.wordCount, 2)
  })
})

describe('formatDuration', () => {
  it('formats as m:ss', () => {
    assert.equal(formatDuration(0), '0:00')
    assert.equal(formatDuration(30_000), '0:30')
    assert.equal(formatDuration(125_000), '2:05')
    assert.equal(formatDuration(3_600_000), '60:00')
  })

  it('never renders a negative clock', () => {
    assert.equal(formatDuration(-5000), '0:00')
  })
})
