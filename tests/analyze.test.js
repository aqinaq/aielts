import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { buildSystemPrompt, buildUserPrompt, resolveProvider } from '../api/analyze.js'
import { analysisSchema, extractJson } from '../api/schema.js'

describe('resolveProvider', () => {
  it('prefers DeepSeek, which the grading prompt was tuned against', () => {
    const provider = resolveProvider({ DEEPSEEK_API_KEY: 'sk-x', GEMINI_API_KEY: 'AQ.y' })
    assert.equal(provider.name, 'DeepSeek')
    assert.equal(provider.apiKey, 'sk-x')
  })

  it('falls back to Gemini so one free key runs the whole app', () => {
    const provider = resolveProvider({ GEMINI_API_KEY: 'AQ.y' })
    assert.equal(provider.name, 'Gemini')
    assert.match(provider.baseURL, /generativelanguage/)
  })

  it('returns null when nothing is configured, rather than a broken client', () => {
    assert.equal(resolveProvider({}), null)
  })

  it('keeps reasoning_effort off Gemini, which rejects unknown parameters', () => {
    assert.deepEqual(resolveProvider({ GEMINI_API_KEY: 'AQ.y' }).options(), {})
    assert.ok('reasoning_effort' in resolveProvider({ DEEPSEEK_API_KEY: 'sk-x' }).options())
  })

  it('reads a bad credential from the status each provider actually uses', () => {
    // Gemini answers an invalid key with 400; DeepSeek uses 400 for a malformed
    // request, so treating it as an auth failure there would mislead.
    assert.ok(resolveProvider({ GEMINI_API_KEY: 'AQ.y' }).badKeyStatuses.includes(400))
    assert.ok(!resolveProvider({ DEEPSEEK_API_KEY: 'sk-x' }).badKeyStatuses.includes(400))
  })
})

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

  it('hedges measured and estimated metrics differently', () => {
    const estimated = buildSystemPrompt({
      mode: 'speaking',
      hasTask: false,
      schema,
      metrics: { wordsPerMinute: 120, measuredPauses: false, verbatim: false },
    })
    assert.match(estimated, /estimated from when the recognizer finalized/)
    assert.match(estimated, /strips "um" and "uh"/)

    const measured = buildSystemPrompt({
      mode: 'speaking',
      hasTask: false,
      schema,
      metrics: { wordsPerMinute: 120, measuredPauses: true, verbatim: true },
    })
    assert.match(measured, /measured directly from the audio/)
    assert.match(measured, /verbatim record/)
    assert.ok(!/strips "um" and "uh"/.test(measured))
  })

  it('does not claim verbatim fillers just because the pauses were measured', () => {
    // Chrome hits this combination on every attempt: real waveform pauses, but
    // a transcript the recognizer already stripped hesitations out of.
    const mixed = buildSystemPrompt({
      mode: 'speaking',
      hasTask: false,
      schema,
      metrics: { wordsPerMinute: 120, measuredPauses: true, verbatim: false },
    })
    assert.match(mixed, /measured directly from the audio/)
    assert.match(mixed, /the true hesitation count is higher/)
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
