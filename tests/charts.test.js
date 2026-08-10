import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  CHARTS,
  SERIES_COLORS,
  allValues,
  describeChart,
  niceTicks,
  spreadLabels,
} from '../src/lib/charts.js'
import { TASK_BANK } from '../src/lib/tasks.js'
import { buildSystemPrompt } from '../api/analyze.js'
import { analysisSchema } from '../api/schema.js'

describe('the chart bank', () => {
  const charts = Object.entries(CHARTS)

  it('covers the Academic Task 1 forms a candidate actually meets', () => {
    const kinds = charts.map(([, chart]) => chart.kind).sort()
    assert.deepEqual(kinds, ['bar', 'line', 'pie', 'table'])
  })

  it('gives every series a value for every category', () => {
    for (const [id, chart] of charts) {
      for (const series of chart.series) {
        assert.equal(
          series.values.length,
          chart.kind === 'pie' ? chart.xLabels.length : chart.xLabels.length,
          `${id}: ${series.name} has the wrong number of values`,
        )
        for (const value of series.values) {
          assert.equal(typeof value, 'number', `${id}: ${series.name} has a non-number`)
          assert.ok(Number.isFinite(value), `${id}: ${series.name} has ${value}`)
        }
      }
    }
  })

  it('stays inside the validated colour slots', () => {
    // The palette clears every colour-blindness gate as a set of these hues;
    // a fifth series would need folding into "Other" instead of a new colour.
    for (const [id, chart] of charts) {
      const marks = chart.kind === 'pie' ? chart.xLabels.length : chart.series.length
      assert.ok(marks <= SERIES_COLORS.length, `${id} needs ${marks} colours`)
    }
  })

  it('keeps each pie a whole', () => {
    const pie = CHARTS['household-spending']
    for (const series of pie.series) {
      const total = series.values.reduce((sum, value) => sum + value, 0)
      assert.equal(total, 100, `${series.name} sums to ${total}`)
    }
  })

  it('keeps pies inside the six segments a reader can hold at a glance', () => {
    assert.ok(CHARTS['household-spending'].xLabels.length <= 6)
  })
})

describe('describeChart', () => {
  const text = describeChart(CHARTS['museum-visitors'])

  it('lays the real figures out for the grader', () => {
    // This is what lets a misreported number be marked as a Task Achievement
    // failure rather than passing as fluent prose.
    assert.match(text, /British Museum \| 6.8 \| 6.4/)
    assert.match(text, /Tate Modern/)
    assert.match(text, /2015 \| 2016/)
  })

  it('names the unit, without which every figure is ambiguous', () => {
    assert.match(text, /million visitors/)
  })

  it('is short enough to sit inside the task field', () => {
    for (const chart of Object.values(CHARTS)) {
      assert.ok(describeChart(chart).length < 900, chart.caption)
    }
  })

  it('returns nothing for a task with no chart', () => {
    assert.equal(describeChart(null), '')
    assert.equal(describeChart(undefined), '')
  })
})

describe('the Academic Task 1 prompts', () => {
  const academic = TASK_BANK.write.filter((task) => task.chartId)

  it('offers one per chart, each pointing at a real one', () => {
    assert.equal(academic.length, Object.keys(CHARTS).length)
    for (const task of academic) {
      assert.ok(CHARTS[task.chartId], `${task.id} points at a missing chart`)
    }
  })

  it('carries the real exam’s allowance and minimum', () => {
    for (const task of academic) {
      assert.equal(task.minutes, 20)
      assert.equal(task.minWords, 150)
    }
  })

  it('leaves the other writing tasks without a chart', () => {
    const essay = TASK_BANK.write.find((task) => task.id === 'w-education')
    assert.equal(essay.chartId, undefined)
  })
})

describe('grading against the figures', () => {
  const schema = analysisSchema('writing', true)

  it('tells the model to check reported numbers when data is supplied', () => {
    const prompt = buildSystemPrompt({
      mode: 'writing',
      hasTask: true,
      hasData: true,
      schema,
    })
    assert.match(prompt, /Check every number and trend they report/)
    assert.match(prompt, /trend described backwards/)
  })

  it('does not ask for selecting every number, which is not the skill', () => {
    const prompt = buildSystemPrompt({
      mode: 'writing',
      hasTask: true,
      hasData: true,
      schema,
    })
    assert.match(prompt, /Do not require them to list every number/)
  })

  it('says nothing about figures for an ordinary essay', () => {
    const prompt = buildSystemPrompt({ mode: 'writing', hasTask: true, schema })
    assert.ok(!/Check every number/.test(prompt))
  })
})

describe('niceTicks', () => {
  it('lands on numbers a reader can use', () => {
    assert.deepEqual(niceTicks(6.8), [0, 2, 4, 6, 8])
    assert.deepEqual(niceTicks(31), [0, 10, 20, 30, 40])
  })

  it('always spans the data', () => {
    for (const max of [0.9, 3.3, 6.8, 31, 90.2, 100]) {
      const ticks = niceTicks(max)
      assert.ok(ticks[ticks.length - 1] >= max, `${max} overflows its axis`)
      assert.equal(ticks[0], 0, 'bars must grow from a real zero')
    }
  })

  it('does not emit floating-point noise', () => {
    for (const max of [0.9, 2.5, 7.5, 6.8]) {
      for (const tick of niceTicks(max)) {
        assert.ok(String(tick).length <= 6, `tick ${tick} is unreadable`)
      }
    }
  })

  it('survives an empty or zero series', () => {
    assert.deepEqual(niceTicks(0), [0])
    assert.deepEqual(niceTicks(-5), [0])
  })
})

describe('spreadLabels', () => {
  it('pushes apart labels that would overlap', () => {
    // The museum lines converge in 2020 — 1.3, 1.4 and 0.9 land within a few
    // pixels, and stacked text is worse than none.
    const spread = spreadLabels([100, 104, 108], 14)
    for (let i = 1; i < spread.length; i += 1) {
      assert.ok(spread[i] - spread[i - 1] >= 14, `gap ${spread[i] - spread[i - 1]}`)
    }
  })

  it('leaves well-separated labels where they are', () => {
    assert.deepEqual(spreadLabels([10, 50, 90], 14), [10, 50, 90])
  })

  it('keeps each label with its own series', () => {
    // Returned in input order, not sorted order — otherwise every label ends up
    // beside the wrong line.
    const spread = spreadLabels([108, 100, 104], 14)
    assert.ok(spread[1] < spread[2], 'the lowest input stays lowest')
    assert.ok(spread[2] < spread[0], 'and the highest stays highest')
  })

  it('handles a single label and none at all', () => {
    assert.deepEqual(spreadLabels([42], 14), [42])
    assert.deepEqual(spreadLabels([], 14), [])
  })
})

describe('allValues', () => {
  it('flattens every series, which is what the axis has to span', () => {
    const values = allValues(CHARTS['housework-hours'])
    assert.equal(values.length, 8)
    assert.equal(Math.max(...values), 31)
  })
})
