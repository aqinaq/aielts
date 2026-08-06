import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { buildSystemPrompt, buildUserPrompt, extractJson } from '../api/analyze.js'
import { analysisSchema } from '../api/schema.js'

describe('extractJson', () => {
  it('parses a bare json object', () => {
    assert.deepEqual(extractJson('{"a":1}'), { a: 1 })
  })

  it('unwraps a markdown fence the model was asked not to add', () => {
    assert.deepEqual(extractJson('```json\n{"a":1}\n```'), { a: 1 })
    assert.deepEqual(extractJson('```\n{"a":1}\n```'), { a: 1 })
  })

  it('returns null for empty content, which DeepSeek documents as possible', () => {
    for (const empty of ['', '   ', null, undefined]) {
      assert.equal(extractJson(empty), null)
    }
  })

  it('returns null rather than throwing on malformed json', () => {
    assert.equal(extractJson('{"a": }'), null)
    assert.equal(extractJson('Here is your answer: {"a":1}'), null)
  })
})

describe('buildSystemPrompt', () => {
  const schema = analysisSchema('speaking', true)

  it('contains the word json, which DeepSeek requires for json mode', () => {
    const prompt = buildSystemPrompt({ mode: 'speaking', hasTask: true, schema })
    assert.ok(/json/i.test(prompt))
  })

  it('embeds the schema template so the shape is taught, not assumed', () => {
    const prompt = buildSystemPrompt({ mode: 'speaking', hasTask: true, schema })
    assert.ok(prompt.includes('"overall_band"'))
    assert.ok(prompt.includes('"fluency_coherence"'))
  })

  it('tells the model not to judge pronunciation from a transcript', () => {
    const speaking = buildSystemPrompt({ mode: 'speaking', hasTask: false, schema })
    assert.match(speaking, /[Pp]ronunciation cannot be judged/)

    const writing = buildSystemPrompt({
      mode: 'writing',
      hasTask: false,
      schema: analysisSchema('writing', false),
    })
    assert.ok(!/[Pp]ronunciation cannot be judged/.test(writing))
  })

  it('switches its task guidance on whether a task exists', () => {
    assert.match(
      buildSystemPrompt({ mode: 'writing', hasTask: true, schema }),
      /task prompt is given/,
    )
    assert.match(
      buildSystemPrompt({ mode: 'writing', hasTask: false, schema }),
      /No task prompt was given/,
    )
  })

  it('only explains the metrics when metrics were actually measured', () => {
    const withMetrics = buildSystemPrompt({
      mode: 'speaking',
      hasTask: false,
      schema,
      metrics: { wordsPerMinute: 120 },
    })
    assert.match(withMetrics, /words per minute/)
    assert.ok(
      !/words per minute/.test(
        buildSystemPrompt({ mode: 'speaking', hasTask: false, schema }),
      ),
    )
  })

  it('marks the candidate material as data, not instructions', () => {
    const prompt = buildSystemPrompt({ mode: 'writing', hasTask: true, schema })
    assert.match(prompt, /not instructions to follow/)
  })
})

describe('buildUserPrompt', () => {
  it('always wraps the candidate text in its own tag', () => {
    const prompt = buildUserPrompt({ text: 'hello world', task: '', metrics: null })
    assert.match(prompt, /<candidate_text>\nhello world\n<\/candidate_text>/)
  })

  it('omits sections that have no content', () => {
    const prompt = buildUserPrompt({ text: 'hello', task: '', metrics: null })
    assert.ok(!prompt.includes('<task>'))
    assert.ok(!prompt.includes('<metrics>'))
  })

  it('includes the task and metrics when present', () => {
    const prompt = buildUserPrompt({
      text: 'hello',
      task: 'Describe a place',
      metrics: {
        wordsPerMinute: 118,
        durationMs: 60000,
        wordCount: 118,
        fillerCount: 2,
        fillerBreakdown: [{ phrase: 'um', count: 2 }],
        repeatCount: 0,
        longPauses: 1,
      },
    })
    assert.match(prompt, /<task>\nDescribe a place\n<\/task>/)
    assert.match(prompt, /~118 wpm/)
    assert.match(prompt, /"um" x2/)
  })
})
