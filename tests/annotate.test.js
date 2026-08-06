import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { buildSegments } from '../src/lib/annotate.js'

const text = 'Yesterday I go to the shop and I buyed some breads for my friend.'

const marksOf = (segments) => segments.filter((segment) => segment.type === 'mark')
const rejoin = (segments) => segments.map((segment) => segment.value).join('')

describe('buildSegments', () => {
  it('marks each correction and keeps the text reconstructible', () => {
    const segments = buildSegments(text, [
      { original: 'I go', corrected: 'I went' },
      { original: 'buyed', corrected: 'bought' },
      { original: 'some breads', corrected: 'some bread' },
    ])

    assert.deepEqual(
      marksOf(segments).map((mark) => mark.value),
      ['I go', 'buyed', 'some breads'],
    )
    assert.equal(rejoin(segments), text, 'segments must reassemble into the original')
  })

  it('numbers marks by their position in the corrections list', () => {
    const segments = buildSegments(text, [
      { original: 'buyed', corrected: 'bought' },
      { original: 'I go', corrected: 'I went' },
    ])
    // Rendered in text order, but numbered by list order.
    assert.deepEqual(
      marksOf(segments).map((mark) => [mark.value, mark.number]),
      [
        ['I go', 2],
        ['buyed', 1],
      ],
    )
  })

  it('skips a phrase the model paraphrased instead of copying', () => {
    const segments = buildSegments(text, [
      { original: 'buyed', corrected: 'bought' },
      { original: 'not present in the text at all', corrected: 'x' },
    ])
    assert.equal(marksOf(segments).length, 1)
    assert.equal(rejoin(segments), text)
  })

  it('gives repeated phrases separate ranges rather than stacking them', () => {
    const segments = buildSegments('the the cat', [
      { original: 'the', corrected: 'a' },
      { original: 'the', corrected: 'a' },
    ])
    const marks = marksOf(segments)
    assert.equal(marks.length, 2)
    assert.notEqual(marks[0].start, marks[1].start)
    assert.ok(marks[0].end <= marks[1].start, 'marks must not overlap')
    assert.equal(rejoin(segments), 'the the cat')
  })

  it('matches case-insensitively but preserves the original casing', () => {
    const segments = buildSegments('Buyed it', [
      { original: 'buyed', corrected: 'bought' },
    ])
    assert.equal(marksOf(segments)[0].value, 'Buyed')
  })

  it('handles no corrections and blank originals', () => {
    assert.deepEqual(buildSegments('nothing here', []), [
      { type: 'text', value: 'nothing here' },
    ])
    assert.equal(marksOf(buildSegments('nothing here', [{ original: '  ' }])).length, 0)
  })
})
