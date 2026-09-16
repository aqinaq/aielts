import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  MISTAKE_CATEGORIES,
  analysisSchema,
  criteriaFields,
  normalizeBands,
  officialBand,
  renderTemplate,
  validate,
} from '../api/schema.js'

const bi = (text = 'x') => ({ kk: text, en: text })
const criterion = (band) => ({ band, comment: bi() })

const validAnalysis = (overrides = {}) => ({
  overall_band: 6.5,
  level: 'B2',
  summary: bi(),
  criteria: {
    fluency_coherence: criterion(6.5),
    lexical_resource: criterion(6),
    grammatical_range: criterion(6),
  },
  task_feedback: bi('On topic.'),
  strengths: [bi()],
  improvements: [bi()],
  corrections: [
    { original: 'i go', corrected: 'i went', category: 'tense', explanation: bi() },
  ],
  next_step: bi(),
  ...overrides,
})

describe('criteriaFields', () => {
  it('uses the IELTS criterion set for each mode', () => {
    assert.ok('fluency_coherence' in criteriaFields('speaking', false))
    assert.ok('coherence_cohesion' in criteriaFields('writing', false))
    assert.ok(!('coherence_cohesion' in criteriaFields('speaking', false)))
  })

  it('keeps prompt relevance separate from the official Speaking criteria', () => {
    assert.ok(!('task_response' in criteriaFields('speaking')))
    assert.ok('task_feedback' in analysisSchema('speaking', true).fields)
    assert.ok(!('task_feedback' in analysisSchema('speaking', false).fields))
    assert.ok('task_achievement' in criteriaFields('writing'))
  })
})

describe('validate', () => {
  it('accepts a well-formed analysis', () => {
    const schema = analysisSchema('speaking', true)
    assert.deepEqual(validate(schema, validAnalysis()), [])
  })

  it('reports a missing top-level key', () => {
    const schema = analysisSchema('speaking', true)
    const { next_step: _nextStep, ...withoutNextStep } = validAnalysis()
    const errors = validate(schema, withoutNextStep)
    assert.equal(errors.length, 1)
    assert.match(errors[0], /next_step.*missing/)
  })

  it('reports a criterion the mode does not have', () => {
    // A writing schema fed a speaking payload: the model answered the wrong shape.
    const errors = validate(analysisSchema('writing', true), validAnalysis())
    assert.ok(errors.some((error) => /coherence_cohesion.*missing/.test(error)))
    assert.ok(errors.some((error) => /task_achievement.*missing/.test(error)))
  })

  it('rejects a half-translated field', () => {
    const errors = validate(
      analysisSchema('speaking', true),
      validAnalysis({ summary: { kk: 'бар', en: '   ' } }),
    )
    assert.deepEqual(errors, ['root.summary.en: missing English text'])
  })

  it('rejects a band that came back as a string', () => {
    const analysis = validAnalysis()
    analysis.criteria.lexical_resource.band = '6.0'
    const errors = validate(analysisSchema('speaking', true), analysis)
    assert.match(errors[0], /lexical_resource\.band: expected a number/)
  })

  it('rejects an unknown mistake category', () => {
    const errors = validate(
      analysisSchema('speaking', true),
      validAnalysis({
        corrections: [
          { original: 'a', corrected: 'b', category: 'grammar', explanation: bi() },
        ],
      }),
    )
    assert.match(errors[0], /category: expected one of/)
  })

  it('accepts an empty corrections array', () => {
    const errors = validate(
      analysisSchema('speaking', true),
      validAnalysis({ corrections: [] }),
    )
    assert.deepEqual(errors, [])
  })

  it('does not throw on junk instead of an object', () => {
    for (const junk of [null, 'text', 42, []]) {
      const errors = validate(analysisSchema('writing', false), junk)
      assert.ok(errors.length > 0, `expected errors for ${JSON.stringify(junk)}`)
    }
  })
})

describe('renderTemplate', () => {
  const template = renderTemplate(analysisSchema('speaking', true))

  it('names every key the validator requires', () => {
    for (const key of [
      'overall_band',
      'level',
      'summary',
      'criteria',
      'strengths',
      'improvements',
      'corrections',
      'next_step',
      'task_feedback',
      'fluency_coherence',
      'category',
    ]) {
      assert.ok(template.includes(`"${key}"`), `template is missing "${key}"`)
    }
  })

  it('lists the allowed enum values so the model can pick one', () => {
    assert.ok(template.includes('A1 | A2 | B1 | B2 | C1 | C2'))
    for (const category of MISTAKE_CATEGORIES) {
      assert.ok(template.includes(category), `template is missing category ${category}`)
    }
  })

  it('omits criteria the mode does not use', () => {
    assert.ok(!template.includes('"coherence_cohesion"'))
  })
})

describe('normalizeBands', () => {
  it('snaps bands onto the half-band grid IELTS uses', () => {
    const normalized = normalizeBands(
      validAnalysis({
        overall_band: 6.37,
        criteria: {
          fluency_coherence: criterion(6.2),
          lexical_resource: criterion(5.9),
          grammatical_range: criterion(6),
          pronunciation: criterion(6.8),
        },
      }),
      'speaking',
    )
    assert.equal(normalized.overall_band, 6.5)
    assert.equal(normalized.criteria.fluency_coherence.band, 6)
    assert.equal(normalized.criteria.lexical_resource.band, 6)
    assert.equal(normalized.criteria.pronunciation.band, 7)
  })

  it('clamps out-of-range bands rather than rendering an impossible score', () => {
    const normalized = normalizeBands(
      validAnalysis({
        overall_band: 11,
        criteria: {
          task_achievement: criterion(11),
          coherence_cohesion: criterion(11),
          lexical_resource: criterion(11),
          grammatical_range: criterion(-2),
        },
      }),
      'writing',
    )
    assert.equal(normalized.overall_band, 7)
    assert.equal(normalized.criteria.grammatical_range.band, 0)
  })

  it('leaves the rest of the analysis untouched', () => {
    const analysis = validAnalysis()
    const normalized = normalizeBands(analysis)
    assert.deepEqual(normalized.corrections, analysis.corrections)
    assert.deepEqual(normalized.summary, analysis.summary)
  })

  it('withholds an overall Speaking band until pronunciation exists', () => {
    const normalized = normalizeBands(validAnalysis(), 'speaking')
    assert.equal(normalized.overall_band, null)
    assert.equal(officialBand(normalized.criteria, 'speaking'), null)
  })

  it('ignores a legacy fifth Speaking criterion when recalculating a stored band', () => {
    const normalized = normalizeBands(validAnalysis({
      criteria: {
        ...validAnalysis().criteria,
        pronunciation: criterion(6),
        task_response: criterion(9),
      },
      task_feedback: undefined,
    }), 'speaking')
    assert.equal(normalized.overall_band, 6)
    assert.ok(!('task_response' in normalized.criteria))
    assert.deepEqual(normalized.task_feedback, bi())
  })
})
