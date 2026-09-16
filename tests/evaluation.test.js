import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { summarizeEvaluation } from '../src/lib/evaluation.js'

const criteria = (band) => ({
  task_achievement: { band },
  coherence_cohesion: { band },
  lexical_resource: { band },
  grammatical_range: { band },
})

describe('evaluation summary', () => {
  it('reports band error, criterion error and verbatim correction grounding', () => {
    const report = summarizeEvaluation([
      {
        id: 'one', text: 'I go yesterday.',
        human: { overall_band: 6, criteria: { task_achievement: 6 } },
        ai: { overall_band: 6.5, criteria: criteria(6.5), corrections: [
          { original: 'I go' }, { original: 'not in answer' },
        ] },
      },
      {
        id: 'two', text: 'A second answer.',
        human: { overall_band: 7, criteria: { task_achievement: 7 } },
        ai: { overall_band: 6, criteria: criteria(6), corrections: [] },
      },
      { id: 'failed', text: 'No model output.', human: { overall_band: 5 }, ai: null },
    ])
    assert.equal(report.attempted, 3)
    assert.equal(report.completed, 2)
    assert.equal(report.failed, 1)
    assert.equal(report.overall.mean_absolute_error, 0.75)
    assert.equal(report.overall.mean_signed_error, -0.25)
    assert.equal(report.overall.within_half_band, 0.5)
    assert.equal(report.criteria.task_achievement.mean_absolute_error, 0.75)
    assert.deepEqual(report.correction_grounding, {
      checked: 2, found_verbatim: 1, rate: 0.5,
    })
  })

  it('returns null metrics instead of claiming accuracy without paired answers', () => {
    const report = summarizeEvaluation([])
    assert.equal(report.completed, 0)
    assert.equal(report.overall.mean_absolute_error, null)
    assert.equal(report.overall.within_half_band, null)
  })
})
