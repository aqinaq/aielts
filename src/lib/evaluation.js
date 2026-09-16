import { OFFICIAL_CRITERIA } from '../../api/schema.js'

const mean = (values) => values.length
  ? values.reduce((sum, value) => sum + value, 0) / values.length
  : null

/** Summarizes paired human/AI bands without treating sample fixtures as evidence. */
export function summarizeEvaluation(records) {
  const completed = records.filter((record) =>
    Number.isFinite(record.human?.overall_band) &&
    Number.isFinite(record.ai?.overall_band),
  )
  const differences = completed.map((record) =>
    record.ai.overall_band - record.human.overall_band,
  )
  const criteria = {}
  for (const name of OFFICIAL_CRITERIA.writing) {
    const pairs = completed.filter((record) =>
      Number.isFinite(record.human?.criteria?.[name]) &&
      Number.isFinite(record.ai?.criteria?.[name]?.band),
    )
    criteria[name] = {
      count: pairs.length,
      mean_absolute_error: mean(pairs.map((record) =>
        Math.abs(record.ai.criteria[name].band - record.human.criteria[name]))),
    }
  }

  const quoted = completed.flatMap((record) =>
    (record.ai.corrections ?? []).map((correction) => ({
      text: record.text,
      original: correction.original,
    })),
  )
  const grounded = quoted.filter((item) =>
    typeof item.original === 'string' && item.text.includes(item.original),
  )

  return {
    attempted: records.length,
    completed: completed.length,
    failed: records.length - completed.length,
    overall: {
      mean_absolute_error: mean(differences.map(Math.abs)),
      mean_signed_error: mean(differences),
      within_half_band: completed.length
        ? differences.filter((difference) => Math.abs(difference) <= 0.5).length / completed.length
        : null,
    },
    criteria,
    correction_grounding: {
      checked: quoted.length,
      found_verbatim: grounded.length,
      rate: quoted.length ? grounded.length / quoted.length : null,
    },
  }
}
