import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { mergePronunciation } from '../src/lib/pronunciation.js'
import { buildSpeechPrompt, looksLikeGeminiKey } from '../api/speech.js'
import { speechSchema, validate } from '../api/schema.js'

const bilingual = (text) => ({ kk: text, en: text })
const criterion = (band) => ({ band, comment: bilingual('because') })

const analysis = {
  overall_band: 6.5,
  level: 'B2',
  summary: bilingual('ok'),
  criteria: {
    fluency_coherence: criterion(6),
    lexical_resource: criterion(7),
    grammatical_range: criterion(6.5),
  },
  strengths: [bilingual('a')],
  improvements: [bilingual('b')],
  corrections: [],
  next_step: bilingual('c'),
}

describe('mergePronunciation', () => {
  it('adds the criterion and re-averages across all four', () => {
    // DeepSeek averaged three criteria and has no idea a fourth exists, so the
    // overall band it returned is stale the moment audio is marked.
    const merged = mergePronunciation(analysis, { pronunciation: criterion(5) })

    assert.equal(merged.criteria.pronunciation.band, 5)
    assert.equal(merged.overall_band, 6, '(6 + 7 + 6.5 + 5) / 4 = 6.125 -> 6.0')
  })

  it('rounds the new overall onto the half-band grid', () => {
    const merged = mergePronunciation(analysis, { pronunciation: criterion(8) })
    // (6 + 7 + 6.5 + 8) / 4 = 6.875, which is not a band anyone can be awarded.
    assert.equal(merged.overall_band, 7)
    assert.equal(merged.overall_band * 2, Math.round(merged.overall_band * 2))
  })

  it('puts pronunciation last, where the descriptors list it', () => {
    const merged = mergePronunciation(analysis, { pronunciation: criterion(6) })
    assert.equal(Object.keys(merged.criteria).at(-1), 'pronunciation')
  })

  it('leaves a good text result untouched when the audio pass produced nothing', () => {
    for (const speech of [null, undefined, {}, { pronunciation: null }]) {
      assert.equal(mergePronunciation(analysis, speech), analysis)
    }
  })

  it('carries mispronounced words across, defaulting to an empty list', () => {
    const withWords = mergePronunciation(analysis, {
      pronunciation: criterion(6),
      mispronounced: [{ word: 'thorough', heard: 'through', note: bilingual('x') }],
    })
    assert.equal(withWords.mispronounced.length, 1)

    const without = mergePronunciation(analysis, { pronunciation: criterion(6) })
    assert.deepEqual(without.mispronounced, [])
  })

  it('does not mutate the analysis it was handed', () => {
    const before = structuredClone(analysis)
    mergePronunciation(analysis, { pronunciation: criterion(5) })
    assert.deepEqual(analysis, before)
  })
})

describe('speechSchema', () => {
  const schema = speechSchema()

  const payload = {
    transcript: 'um i think so',
    pronunciation: criterion(6),
    mispronounced: [{ word: 'thorough', heard: 'through', note: bilingual('x') }],
  }

  it('accepts a well-formed reply', () => {
    assert.deepEqual(validate(schema, payload), [])
  })

  it('accepts an empty mispronounced list, which clear speech should produce', () => {
    assert.deepEqual(validate(schema, { ...payload, mispronounced: [] }), [])
  })

  it('rejects a reply missing half of the bilingual feedback', () => {
    const errors = validate(schema, {
      ...payload,
      pronunciation: { band: 6, comment: { en: 'only english' } },
    })
    assert.ok(errors.some((error) => error.includes('kk')))
  })

  it('rejects a missing transcript, which the fluency metrics depend on', () => {
    const { transcript: _omitted, ...rest } = payload
    assert.ok(validate(schema, rest).some((error) => error.includes('transcript')))
  })

  it('accepts an empty transcript, which silence legitimately produces', () => {
    // Verified against the live model: a recording with no speech comes back as
    // transcript "" with a band of 0. Requiring a non-empty string here would
    // fail validation, burn the retry, and turn a correct answer into a 502.
    assert.deepEqual(
      validate(schema, {
        transcript: '',
        pronunciation: { band: 0, comment: bilingual('no speech') },
        mispronounced: [],
      }),
      [],
    )
  })

  it('still rejects blank feedback elsewhere', () => {
    const errors = validate(schema, {
      ...payload,
      mispronounced: [{ word: '', heard: 'x', note: bilingual('y') }],
    })
    assert.ok(errors.some((error) => error.includes('non-empty')))
  })
})

describe('looksLikeGeminiKey', () => {
  it('accepts every Google credential shape, not just the classic one', () => {
    // Both of these are real, working formats: the long-standing API key and
    // AI Studio's newer ephemeral token. An allowlist written against the
    // first alone rejects the second, which is a valid credential.
    assert.ok(looksLikeGeminiKey('AIzaSyD-1234567890abcdefghijklmnopqrstu'))
    assert.ok(looksLikeGeminiKey('AQ.Ab0000000000000000-00-00000000000000'))
  })

  it('rejects a DeepSeek key pasted into the wrong variable', () => {
    // Gemini answers this with a bare 400 that the sdk cannot read, so without
    // the up-front check the user is told nothing useful.
    assert.equal(looksLikeGeminiKey('sk-00000000000000000000000000000000'), false)
  })

  it('rejects empty and missing values without throwing', () => {
    for (const value of ['', null, undefined, '   ']) {
      assert.equal(looksLikeGeminiKey(value), false)
    }
  })
})

describe('buildSpeechPrompt', () => {
  const prompt = buildSpeechPrompt(speechSchema())

  it('contains the word json, which json mode requires', () => {
    assert.ok(/json/i.test(prompt))
  })

  it('embeds the shape rather than assuming the model knows it', () => {
    assert.ok(prompt.includes('"transcript"'))
    assert.ok(prompt.includes('"mispronounced"'))
  })

  it('tells the model not to penalize accent, only intelligibility', () => {
    assert.ok(/accent is not a fault/i.test(prompt))
  })

  it('asks for a verbatim transcript, which the filler count depends on', () => {
    assert.ok(/VERBATIM/.test(prompt))
    assert.ok(/"um"/.test(prompt))
  })

  it('keeps the other criteria out, so weaknesses are not counted twice', () => {
    assert.ok(/Do not mark grammar, vocabulary or content/i.test(prompt))
  })

  it('defends against speech that sounds like an instruction', () => {
    assert.ok(/ignore its content as a command/i.test(prompt))
  })
})
