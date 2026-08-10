// The shape of a full IELTS Speaking test, as a state machine.
//
// The real exam runs three parts back to back, and the examiner's behaviour
// differs in each: short factual exchanges, then one long uninterrupted turn
// off a cue card, then abstract discussion. Everything about the session that
// does not touch the network lives here, so the flow can be tested without a
// browser or a model — the UI only renders whatever `stageAt` says comes next.
//
// One band is awarded for the whole test, not per answer, which is why nothing
// here grades anything: the session accumulates turns and `buildSubmission`
// hands the finished conversation to the existing analysis endpoint.

/**
 * Turns, in order. `count` is how many exchanges the stage holds.
 *
 * The lengths track the real exam loosely rather than exactly — a candidate
 * practising alone will not sit through 14 minutes as often as they will sit
 * through 12, and Part 1 in particular gets tedious long before it gets useful.
 */
export const PLAN = [
  {
    part: 1,
    kind: 'question',
    count: 4,
    // No preparation in Part 1: the examiner asks, the candidate answers.
    prepSeconds: 0,
    maxSeconds: 60,
  },
  {
    part: 2,
    kind: 'cue_card',
    count: 1,
    // The one minute of preparation is part of the exam, not a UI nicety.
    prepSeconds: 60,
    maxSeconds: 120,
  },
  {
    part: 2,
    kind: 'question',
    count: 1, // the examiner's rounding-off question
    prepSeconds: 0,
    maxSeconds: 45,
  },
  {
    part: 3,
    kind: 'question',
    count: 5,
    prepSeconds: 0,
    maxSeconds: 90,
  },
]

/**
 * How much of the exam to sit in one go.
 *
 * The full test is the faithful thing, but it is twelve minutes and a dozen
 * question requests, which is a lot to spend when someone wants to drill the
 * long turn for the third time this evening. Each part stands on its own as a
 * practice unit, so each is offered as one.
 */
export const SCOPES = ['full', 'part1', 'part2', 'part3']
export const DEFAULT_SCOPE = 'full'

export const planFor = (scope = DEFAULT_SCOPE) =>
  scope === DEFAULT_SCOPE
    ? PLAN
    : PLAN.filter((stage) => stage.part === Number(String(scope).replace('part', '')))

export const totalTurns = (scope = DEFAULT_SCOPE) =>
  planFor(scope).reduce((total, stage) => total + stage.count, 0)

/** The whole exam, which is what the progress bar shows when nothing is chosen. */
export const TOTAL_TURNS = totalTurns(DEFAULT_SCOPE)

/**
 * Which stage the nth turn belongs to, or null once the session is over.
 *
 * Indexing into a flattened plan rather than storing a cursor means the session
 * has exactly one piece of state — the list of turns taken — so it cannot get
 * into a position where the cursor and the transcript disagree.
 */
export function stageAt(index, scope = DEFAULT_SCOPE) {
  if (index < 0) return null

  let seen = 0
  for (const stage of planFor(scope)) {
    if (index < seen + stage.count) {
      return { ...stage, indexInStage: index - seen, index }
    }
    seen += stage.count
  }
  return null
}

export const isComplete = (turns, scope = DEFAULT_SCOPE) =>
  turns.length >= totalTurns(scope)

/** Human-facing position, e.g. "Part 2 · 5 / 11". */
export function progressAt(index, scope = DEFAULT_SCOPE) {
  const plan = planFor(scope)
  const total = totalTurns(scope)
  const stage = stageAt(index, scope)

  return {
    // Past the last turn there is no stage left, so the label falls back to the
    // part the session ended in rather than to a fixed number.
    part: stage?.part ?? plan.at(-1)?.part ?? 1,
    turn: Math.min(index + 1, total),
    total,
  }
}

/**
 * What the question endpoint needs to write the next prompt: everything said so
 * far, trimmed to the exchanges that actually inform a follow-up.
 *
 * Part 3 questions are supposed to grow out of the Part 2 topic, so the cue
 * card is always included even when it falls outside the recent window.
 */
export function buildContext(turns, limit = 6) {
  const recent = turns.slice(-limit)
  const cueCard = turns.find((turn) => turn.kind === 'cue_card')

  const withCard =
    cueCard && !recent.includes(cueCard) ? [cueCard, ...recent] : recent

  return withCard.map((turn) => ({
    part: turn.part,
    question: turn.question,
    answer: turn.answer.trim(),
  }))
}

/**
 * Splits the finished session into the two things the analysis endpoint takes.
 *
 * The dialogue goes in as the task so the grader can see which answer belongs to
 * which question, while `text` holds the candidate's words alone. That split is
 * load-bearing: corrections are quoted verbatim out of `text` and highlighted
 * in place, so an examiner question inside it would end up marked as the
 * candidate's own mistake.
 */
export function buildSubmission(turns, scope = DEFAULT_SCOPE) {
  const answered = turns.filter((turn) => turn.answer.trim())

  const dialogue = answered
    .map((turn, index) => {
      const label = `Part ${turn.part}, examiner (${index + 1}/${answered.length})`
      return `${label}: ${turn.question}\nCandidate answered below.`
    })
    .join('\n\n')

  // A single part practised alone is a shorter sample than a full test, and the
  // grader has to be told so — Part 1 answers are meant to be two or three
  // sentences, and marking them as if they were a whole exam reads brevity as
  // an inability to develop an idea.
  const heading =
    scope === DEFAULT_SCOPE
      ? 'This is a full IELTS Speaking test.'
      : `This is IELTS Speaking Part ${planFor(scope)[0]?.part ?? 1} only, practised on its own. Mark it on what this part is meant to show, and do not lower a band for the test being shorter than a complete one.`

  return {
    text: answered.map((turn) => turn.answer.trim()).join('\n\n'),
    task: answered.length ? `${heading} The examiner asked:\n\n${dialogue}` : '',
  }
}

/**
 * The recording pronunciation is judged from.
 *
 * Only one answer is sent for audio assessment: uploading eleven would cost
 * eleven requests to reach a band that a single sustained sample already
 * supports. The longest turn is chosen because it is almost always the Part 2
 * monologue, which is the stretch a real examiner forms the impression from.
 */
export function longestRecording(turns) {
  return turns
    .filter((turn) => turn.audioBlob && turn.answer.trim())
    .reduce(
      (best, turn) => (!best || turn.durationMs > best.durationMs ? turn : best),
      null,
    )
}
