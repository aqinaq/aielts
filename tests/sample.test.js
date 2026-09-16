import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { SAMPLE_RESULT, SAMPLE_TEXT } from '../src/lib/sampleResult.js'
import { buildSegments } from '../src/lib/annotate.js'
import { analysisSchema, validate } from '../api/schema.js'

// The sample is the first thing a visitor sees, and it is hand-written rather
// than model-generated — so it needs the same checks a real response gets.
describe('sample analysis', () => {
  it('satisfies the same schema a live response must', () => {
    assert.deepEqual(validate(analysisSchema('speaking', true), SAMPLE_RESULT), [])
  })

  it('quotes every correction verbatim from the sample text', () => {
    for (const correction of SAMPLE_RESULT.corrections) {
      assert.ok(
        SAMPLE_TEXT.toLowerCase().includes(correction.original.toLowerCase()),
        `correction not found in the text: "${correction.original}"`,
      )
    }
  })

  it('highlights every correction inline', () => {
    const marks = buildSegments(SAMPLE_TEXT, SAMPLE_RESULT.corrections).filter(
      (segment) => segment.type === 'mark',
    )
    assert.equal(marks.length, SAMPLE_RESULT.corrections.length)
  })

  it('has an overall band equal to the rounded mean of its criteria', () => {
    const bands = Object.values(SAMPLE_RESULT.criteria).map((c) => c.band)
    const mean = bands.reduce((sum, band) => sum + band, 0) / bands.length
    assert.equal(SAMPLE_RESULT.overall_band, Math.round(mean * 2) / 2)
  })

  it('uses the full speaking criterion set, pronunciation included', () => {
    assert.deepEqual(Object.keys(SAMPLE_RESULT.criteria).sort(), [
      'fluency_coherence',
      'grammatical_range',
      'lexical_resource',
      'pronunciation',
    ])
    assert.ok(SAMPLE_RESULT.task_feedback.kk && SAMPLE_RESULT.task_feedback.en)
  })

  it('shows the pronunciation examples a real audio pass would return', () => {
    assert.ok(SAMPLE_RESULT.mispronounced.length > 0)
    for (const item of SAMPLE_RESULT.mispronounced) {
      assert.ok(item.word && item.heard, 'both spellings are needed to show a contrast')
      assert.notEqual(item.word, item.heard, 'a fix that changes nothing teaches nothing')
      assert.ok(item.note.kk && item.note.en, 'feedback is bilingual everywhere else')
    }
  })
})
