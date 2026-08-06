// The shape of an analysis, described once.
//
// DeepSeek's JSON mode (`response_format: {type: 'json_object'}`) guarantees
// *valid JSON* and nothing else — there is no JSON Schema enforcement the way
// there is on some other providers. So the shape has to be taught to the model
// in the prompt and checked again on the way back.
//
// Both come from this one descriptor: `renderTemplate()` builds the example the
// prompt shows, `validate()` checks what came back. Keeping them in one place is
// the point — a schema described in the prompt but validated separately drifts
// apart the first time anyone edits one of them.

export const MISTAKE_CATEGORIES = [
  'article',
  'tense',
  'agreement',
  'preposition',
  'word_form',
  'word_order',
  'vocabulary',
  'plural',
  'spelling',
  'punctuation',
  'other',
]

const num = (hint) => ({ kind: 'number', hint })
const str = (hint) => ({ kind: 'string', hint })
const enumOf = (values) => ({ kind: 'enum', values })
const bilingual = (hint) => ({ kind: 'bilingual', hint })
const arrayOf = (of, hint) => ({ kind: 'array', of, hint })
const object = (fields) => ({ kind: 'object', fields })

const criterion = (hint) =>
  object({
    band: num('0-9 in steps of 0.5'),
    comment: bilingual(`2-3 sentences justifying the ${hint} band, quoting the candidate`),
  })

/**
 * Criteria depend on the mode, and the task criterion only exists when a task
 * was supplied — a model asked to grade "task achievement" with no task will
 * invent one.
 */
export function criteriaFields(mode, hasTask) {
  const fields = {}

  if (hasTask) {
    fields[mode === 'speaking' ? 'task_response' : 'task_achievement'] = criterion(
      'task response — does it answer every part of the prompt and meet the stated requirements',
    )
  }

  if (mode === 'speaking') {
    fields.fluency_coherence = criterion(
      'fluency and coherence — pace, hesitation, repetition, logical flow',
    )
  } else {
    fields.coherence_cohesion = criterion(
      'coherence and cohesion — paragraphing, progression, linking devices',
    )
  }

  fields.lexical_resource = criterion(
    'lexical resource — range, precision, collocation',
  )
  fields.grammatical_range = criterion(
    'grammatical range and accuracy — variety of structures, density of errors',
  )

  return fields
}

export function analysisSchema(mode, hasTask) {
  return object({
    overall_band: num('0-9 in steps of 0.5; the mean of the criterion bands, rounded to the nearest half band'),
    level: enumOf(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']),
    summary: bilingual('2-3 sentences on the overall impression'),
    criteria: object(criteriaFields(mode, hasTask)),
    strengths: arrayOf(bilingual('one specific strength'), '2-4 items'),
    improvements: arrayOf(
      bilingual('one actionable improvement'),
      '2-4 items, biggest band gain first',
    ),
    corrections: arrayOf(
      object({
        original: str(
          'the erroneous phrase copied VERBATIM from the candidate text, character for character, a few words long',
        ),
        corrected: str('the corrected phrase, in English'),
        category: enumOf(MISTAKE_CATEGORIES),
        explanation: bilingual('why the fix is needed'),
      }),
      '0-8 items; empty array if there are no clear errors',
    ),
    next_step: bilingual('one practice exercise to do next'),
  })
}

// --- prompt rendering -------------------------------------------------------

function renderNode(node, indent) {
  const pad = ' '.repeat(indent)
  const inner = ' '.repeat(indent + 2)

  switch (node.kind) {
    case 'number':
      return `<number: ${node.hint}>`
    case 'string':
      return `"<${node.hint}>"`
    case 'enum':
      return `"<one of: ${node.values.join(' | ')}>"`
    case 'bilingual':
      return `{ "kk": "<Kazakh: ${node.hint}>", "en": "<English: ${node.hint}>" }`
    case 'array':
      return `[\n${inner}${renderNode(node.of, indent + 2)}\n${pad}]  // ${node.hint}`
    case 'object': {
      const body = Object.entries(node.fields)
        .map(([key, value]) => `${inner}"${key}": ${renderNode(value, indent + 2)}`)
        .join(',\n')
      return `{\n${body}\n${pad}}`
    }
    default:
      throw new Error(`unknown node kind: ${node.kind}`)
  }
}

/** The literal json skeleton shown to the model. */
export const renderTemplate = (schema) => renderNode(schema, 0)

// --- validation -------------------------------------------------------------

const isPlainObject = (value) =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const nonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0

function check(node, value, path, errors) {
  switch (node.kind) {
    case 'number':
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        errors.push(`${path}: expected a number, got ${JSON.stringify(value)}`)
      }
      break

    case 'string':
      if (!nonEmptyString(value)) errors.push(`${path}: expected a non-empty string`)
      break

    case 'enum':
      if (!node.values.includes(value)) {
        errors.push(`${path}: expected one of ${node.values.join('|')}, got ${JSON.stringify(value)}`)
      }
      break

    case 'bilingual':
      if (!isPlainObject(value)) {
        errors.push(`${path}: expected {kk, en}`)
      } else {
        if (!nonEmptyString(value.kk)) errors.push(`${path}.kk: missing Kazakh text`)
        if (!nonEmptyString(value.en)) errors.push(`${path}.en: missing English text`)
      }
      break

    case 'array':
      if (!Array.isArray(value)) {
        errors.push(`${path}: expected an array`)
      } else {
        value.forEach((item, index) => check(node.of, item, `${path}[${index}]`, errors))
      }
      break

    case 'object':
      if (!isPlainObject(value)) {
        errors.push(`${path}: expected an object`)
      } else {
        for (const [key, child] of Object.entries(node.fields)) {
          if (!(key in value)) errors.push(`${path}.${key}: missing`)
          else check(child, value[key], `${path}.${key}`, errors)
        }
      }
      break

    default:
      throw new Error(`unknown node kind: ${node.kind}`)
  }
}

/** Returns a list of human-readable problems; empty means the payload is usable. */
export function validate(schema, value) {
  const errors = []
  check(schema, value, 'root', errors)
  return errors
}

/**
 * Rounds bands onto the half-band grid the UI and IELTS both assume, and clamps
 * them into range. The model is asked for halves but nothing enforces it, and a
 * band of 6.37 would render as "6.4" — a score that does not exist.
 */
export function normalizeBands(analysis) {
  const toBand = (value) => Math.min(9, Math.max(0, Math.round(value * 2) / 2))

  return {
    ...analysis,
    overall_band: toBand(analysis.overall_band),
    criteria: Object.fromEntries(
      Object.entries(analysis.criteria).map(([key, criterion]) => [
        key,
        { ...criterion, band: toBand(criterion.band) },
      ]),
    ),
  }
}
