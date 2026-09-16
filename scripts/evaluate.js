import { readFile, writeFile } from 'node:fs/promises'

import { summarizeEvaluation } from '../src/lib/evaluation.js'
import { OFFICIAL_CRITERIA } from '../api/schema.js'

function argument(name) {
  const index = process.argv.indexOf(name)
  return index < 0 ? null : process.argv[index + 1]
}

const datasetPath = argument('--dataset')
const predictionsPath = argument('--predictions')
const baseUrl = argument('--base-url')
const outputPath = argument('--output')
const delayMs = Number(argument('--delay-ms') ?? 1000)

if (!datasetPath || Boolean(predictionsPath) === Boolean(baseUrl)) {
  throw new Error('Usage: npm run eval -- --dataset answers.json (--predictions outputs.json | --base-url http://localhost:5173) [--output report.json]')
}
if (!Number.isFinite(delayMs) || delayMs < 0) throw new Error('--delay-ms must be non-negative')

const records = JSON.parse(await readFile(datasetPath, 'utf8'))
if (!Array.isArray(records) || records.length === 0) throw new Error('The dataset must contain at least one labelled answer')
const seenIds = new Set()
for (const record of records) {
  if (
    typeof record.id !== 'string' || !record.id || seenIds.has(record.id) || record.mode !== 'writing' ||
    !record.task?.trim() || !record.text?.trim() ||
    !Number.isFinite(record.human?.overall_band) ||
    !OFFICIAL_CRITERIA.writing.every((name) => Number.isFinite(record.human?.criteria?.[name]))
  ) {
    throw new Error(`Invalid labelled Writing answer: ${record.id ?? '(missing id)'}`)
  }
  seenIds.add(record.id)
}

let predictions = null
if (predictionsPath) {
  predictions = JSON.parse(await readFile(predictionsPath, 'utf8'))
  if (!Array.isArray(predictions)) throw new Error('Predictions must be an array of {id, ai} objects')
  if (new Set(predictions.map((item) => item.id)).size !== predictions.length) {
    throw new Error('Predictions contain duplicate IDs')
  }
  predictions = new Map(predictions.map((item) => [item.id, item.ai]))
}

const paired = []
const failures = []
for (const record of records) {
  let ai = predictions?.get(record.id) ?? null
  if (baseUrl) {
    try {
      const response = await fetch(new URL('/api/analyze', baseUrl), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          mode: 'writing',
          lang: 'en',
          task: record.task,
          text: record.text,
        }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error ?? `HTTP ${response.status}`)
      ai = payload
    } catch (error) {
      failures.push({ id: record.id, error: error.message })
    }
    if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs))
  } else if (!ai) {
    failures.push({ id: record.id, error: 'No prediction for this answer' })
  }
  paired.push({ ...record, ai })
}

const report = {
  generated_at: new Date().toISOString(),
  method: baseUrl ? 'live API' : 'saved predictions',
  dataset: datasetPath,
  ...summarizeEvaluation(paired),
  failures,
}
const output = `${JSON.stringify(report, null, 2)}\n`
if (outputPath) await writeFile(outputPath, output)
else process.stdout.write(output)
if (failures.length) process.exitCode = 1
