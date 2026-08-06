import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { aggregateMistakes, totalCorrections } from '../src/lib/mistakes.js'

const correction = (category, original = 'x') => ({
  original,
  corrected: `${original}!`,
  category,
  explanation: { kk: 'a', en: 'a' },
})

const attempt = (id, ...categories) => ({
  id,
  result: { corrections: categories.map((category) => correction(category, id + category)) },
})

describe('aggregateMistakes', () => {
  it('ranks categories by how often they occur', () => {
    const patterns = aggregateMistakes([
      attempt('a', 'article', 'tense', 'article'),
      attempt('b', 'article', 'tense'),
      attempt('c', 'article'),
    ])

    assert.deepEqual(
      patterns.map((pattern) => [pattern.category, pattern.total, pattern.attempts]),
      [
        ['article', 4, 3],
        ['tense', 2, 2],
      ],
    )
  })

  it('counts an attempt once per category, however many times it appears', () => {
    // One messy answer must not look like a long-running habit.
    const [pattern] = aggregateMistakes([attempt('a', 'article', 'article', 'article')], {
      minTotal: 1,
    })
    assert.equal(pattern.total, 3)
    assert.equal(pattern.attempts, 1)
  })

  it('hides one-off mistakes below the threshold', () => {
    const patterns = aggregateMistakes([attempt('a', 'article'), attempt('b', 'tense')])
    assert.deepEqual(patterns, [])
  })

  it('keeps a few worked examples per pattern', () => {
    const [pattern] = aggregateMistakes([
      attempt('a', 'article', 'article'),
      attempt('b', 'article', 'article'),
    ])
    assert.equal(pattern.examples.length, 3, 'capped at three examples')
    assert.ok(pattern.examples.every((example) => example.original && example.corrected))
  })

  it('files corrections saved before categories existed under "other"', () => {
    const legacy = {
      id: 'old',
      result: { corrections: [{ original: 'a', corrected: 'b' }, { original: 'c', corrected: 'd' }] },
    }
    const [pattern] = aggregateMistakes([legacy])
    assert.equal(pattern.category, 'other')
    assert.equal(pattern.total, 2)
  })

  it('survives entries with no analysis attached', () => {
    assert.deepEqual(aggregateMistakes([{ id: 'x' }, { id: 'y', result: {} }]), [])
    assert.deepEqual(aggregateMistakes([]), [])
  })

  it('respects the limit', () => {
    const categories = ['article', 'tense', 'agreement', 'preposition', 'plural', 'spelling']
    const entries = categories.map((category, index) => attempt(`a${index}`, category, category))
    assert.equal(aggregateMistakes(entries).length, 5)
    assert.equal(aggregateMistakes(entries, { limit: 2 }).length, 2)
  })
})

describe('totalCorrections', () => {
  it('sums corrections across attempts', () => {
    assert.equal(totalCorrections([attempt('a', 'article', 'tense'), attempt('b', 'article')]), 3)
  })

  it('treats missing results as zero', () => {
    assert.equal(totalCorrections([{ id: 'x' }, { id: 'y', result: {} }]), 0)
    assert.equal(totalCorrections([]), 0)
  })
})
