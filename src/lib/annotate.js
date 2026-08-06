/**
 * Splits the candidate's text into plain and highlighted segments, one per
 * correction, numbered to match the list rendered underneath.
 *
 * The model is asked to copy `original` verbatim, but it does paraphrase
 * occasionally — a phrase that can't be located is simply left unhighlighted
 * rather than dropped from the feedback.
 */
export function buildSegments(text, corrections = []) {
  const haystack = text.toLowerCase()
  const marks = []

  corrections.forEach((correction, index) => {
    const needle = correction.original?.trim().toLowerCase()
    if (!needle) return

    // Take the first occurrence that isn't already claimed by another mark.
    let from = 0
    while (from <= haystack.length) {
      const start = haystack.indexOf(needle, from)
      if (start === -1) return

      const end = start + needle.length
      const overlaps = marks.some((mark) => start < mark.end && end > mark.start)
      if (!overlaps) {
        marks.push({ start, end, number: index + 1, correction })
        return
      }
      from = start + 1
    }
  })

  marks.sort((a, b) => a.start - b.start)

  const segments = []
  let cursor = 0
  for (const mark of marks) {
    if (mark.start > cursor) {
      segments.push({ type: 'text', value: text.slice(cursor, mark.start) })
    }
    segments.push({ type: 'mark', value: text.slice(mark.start, mark.end), ...mark })
    cursor = mark.end
  }
  if (cursor < text.length) {
    segments.push({ type: 'text', value: text.slice(cursor) })
  }

  return segments
}
