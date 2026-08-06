// Turns a pile of past corrections into the one thing a single analysis can
// never tell you: which mistake you keep making.
//
// A grader says "this sentence is wrong". A tutor says "that is the sixth time
// you have dropped an article." Everything here works off history that is
// already stored — no extra request, no extra field to fetch.

const FALLBACK_CATEGORY = 'other'
const MAX_EXAMPLES = 3

/**
 * @param entries history entries, newest first
 * @returns patterns sorted by how often they recur, most frequent first
 */
export function aggregateMistakes(entries, { minTotal = 2, limit = 5 } = {}) {
  const byCategory = new Map()

  for (const entry of entries) {
    const corrections = entry.result?.corrections ?? []
    // One attempt counts once towards `attempts` no matter how many times the
    // same category appears inside it, so a single messy answer can't look like
    // a long-running habit.
    const seenInThisAttempt = new Set()

    for (const correction of corrections) {
      const category = correction.category ?? FALLBACK_CATEGORY
      const pattern = byCategory.get(category) ?? {
        category,
        total: 0,
        attempts: 0,
        examples: [],
      }

      pattern.total += 1
      if (!seenInThisAttempt.has(category)) {
        pattern.attempts += 1
        seenInThisAttempt.add(category)
      }
      if (pattern.examples.length < MAX_EXAMPLES) {
        pattern.examples.push({
          original: correction.original,
          corrected: correction.corrected,
        })
      }

      byCategory.set(category, pattern)
    }
  }

  return [...byCategory.values()]
    .filter((pattern) => pattern.total >= minTotal)
    .sort((a, b) => b.total - a.total || b.attempts - a.attempts)
    .slice(0, limit)
}

/** Total corrections seen across the given attempts — the denominator for shares. */
export const totalCorrections = (entries) =>
  entries.reduce((sum, entry) => sum + (entry.result?.corrections?.length ?? 0), 0)
