import { useEffect, useRef, useState } from 'react'
import { AlertCircle, ArrowRight, GraduationCap, RotateCcw, Timer } from 'lucide-react'

import { useLanguage } from '../i18n'
import { DEFAULT_SCOPE, SCOPES, progressAt, totalTurns } from '../lib/interview'
import { formatDuration } from '../lib/speechMetrics'
import RecordButton from './RecordButton'
import TranscriptArea from './TranscriptArea'

/**
 * The one minute of thinking time before the Part 2 long turn.
 *
 * It counts down on its own because that is what the real exam does — the
 * examiner starts the clock, not the candidate. Hitting record early is allowed
 * and simply ends the preparation.
 */
function PrepCountdown({ seconds, onDone }) {
  const { t } = useLanguage()
  const [left, setLeft] = useState(seconds)

  // `onDone` is read through a ref so a parent that re-creates the callback on
  // every render cannot restart the countdown.
  const done = useRef(onDone)
  useEffect(() => {
    done.current = onDone
  })

  useEffect(() => {
    setLeft(seconds)
    const deadline = Date.now() + seconds * 1000
    const id = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000))
      setLeft(remaining)
      if (remaining === 0) {
        clearInterval(id)
        done.current?.()
      }
    }, 250)
    return () => clearInterval(id)
  }, [seconds])

  return (
    <div className="flex items-center gap-3 rounded-xl bg-amber-50 px-4 py-3">
      <Timer className="size-4 shrink-0 text-amber-600" aria-hidden="true" />
      <span className="text-sm text-amber-900">{t('interview.prepLabel')}</span>
      <span
        aria-live="polite"
        className="ml-auto font-mono text-lg tabular-nums text-amber-900"
      >
        0:{String(left).padStart(2, '0')}
      </span>
    </div>
  )
}

function TurnList({ turns, total }) {
  const { t } = useLanguage()
  if (turns.length === 0) return null

  return (
    <ol className="space-y-3">
      {turns.map((turn, index) => (
        <li
          key={index}
          className="rounded-xl border border-slate-200 bg-white p-4 text-sm"
        >
          <p className="flex items-center gap-2 text-xs font-medium text-slate-400">
            <span className="rounded bg-slate-100 px-1.5 py-0.5">
              {t('interview.part', { n: turn.part })}
            </span>
            {index + 1}/{total}
          </p>
          <p className="mt-1.5 font-medium text-slate-700">{turn.question}</p>
          <p className="mt-1 leading-relaxed text-slate-500">
            {turn.answer.trim() || t('interview.noAnswer')}
          </p>
        </li>
      ))}
    </ol>
  )
}

export default function Interview({
  status,
  current,
  turns,
  error,
  turnError,
  recorderError,
  scope = DEFAULT_SCOPE,
  isSupported,
  isListening,
  isSubmitting,
  elapsedMs,
  transcript,
  interim,
  onStart,
  onToggleRecord,
  onTranscriptChange,
  onSubmit,
  onRetry,
  onFinishEarly,
}) {
  const { t } = useLanguage()

  // Preparation is skipped once recording starts, and never comes back for the
  // same question — re-showing it after a pause would hand out extra thinking
  // time the exam does not allow.
  //
  // Seeded from the question rather than switched on by an effect: effects do
  // not run when the component is rendered on the server, and a Part 2 card
  // that arrived without its clock would silently drop the minute.
  const [isPreparing, setIsPreparing] = useState(() => (current?.prepSeconds ?? 0) > 0)
  // Keyed on the turn number rather than the question text: two turns can
  // legitimately carry the same wording, and comparing strings would then skip
  // the reset and leave the previous turn's countdown state in place.
  const turnRef = useRef(current?.index)
  useEffect(() => {
    if (turnRef.current === current?.index) return
    turnRef.current = current?.index
    setIsPreparing((current?.prepSeconds ?? 0) > 0)
  }, [current])

  useEffect(() => {
    if (isListening) setIsPreparing(false)
  }, [isListening])

  if (status === 'idle') {
    return (
      <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6">
        <div className="space-y-1.5 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-indigo-50">
            <GraduationCap className="size-6 text-indigo-600" aria-hidden="true" />
          </span>
          <h2 className="pt-3 font-semibold text-slate-900">
            {t('interview.introTitle')}
          </h2>
          <p className="mx-auto max-w-md text-sm leading-relaxed text-slate-500">
            {t('interview.introBody')}
          </p>
        </div>

        {error && (
          <p className="flex gap-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {error}
          </p>
        )}

        {/* Each part is a practice unit on its own: the full test is faithful
            but long, and drilling the Part 2 long turn should not require
            sitting through eight other questions first. */}
        <ul className="space-y-2">
          {SCOPES.map((option) => (
            <li key={option}>
              <button
                type="button"
                onClick={() => onStart(option)}
                disabled={!isSupported}
                className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${
                  option === DEFAULT_SCOPE
                    ? 'border-indigo-200 bg-indigo-50/60 hover:border-indigo-400'
                    : 'border-slate-200 hover:border-indigo-300'
                }`}
              >
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-900">
                    {t(`interview.scope.${option}`)}
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                    {t(`interview.scopeHint.${option}`)}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-medium tabular-nums text-slate-500 ring-1 ring-slate-200">
                  {t('interview.turnCount', { n: totalTurns(option) })}
                </span>
              </button>
            </li>
          ))}
        </ul>

        {!isSupported && (
          <p className="text-center text-xs text-amber-700">{t('interview.needsMic')}</p>
        )}
      </div>
    )
  }

  // While the first question is still being written there is no `current` yet,
  // and the turn about to be taken is the one at `turns.length` — reading the
  // part off the previous turn instead would announce Part 3 before Part 1 has
  // even been asked.
  const position = progressAt(current ? current.index : turns.length, scope)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-full bg-indigo-50 px-3 py-1 text-sm font-medium text-indigo-700">
          {t('interview.part', { n: position.part })}
        </span>
        <span className="text-sm tabular-nums text-slate-400">
          {position.turn} / {position.total}
        </span>

        {status !== 'finished' && turns.length > 0 && (
          <button
            type="button"
            onClick={onFinishEarly}
            disabled={isSubmitting}
            className="ml-auto rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-rose-300 hover:text-rose-700"
          >
            {t('interview.finishEarly')}
          </button>
        )}
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-indigo-500 transition-[width] duration-500"
          style={{ width: `${(position.turn / position.total) * 100}%` }}
        />
      </div>

      {status === 'asking' && (
        <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
          {t('interview.thinking')}
        </p>
      )}

      {error && (
        <div className="space-y-3 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">
          <p className="flex gap-2">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {error}
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-medium text-rose-700 transition hover:border-rose-300"
          >
            <RotateCcw className="size-3.5" aria-hidden="true" />
            {t('actions.retry')}
          </button>
        </div>
      )}

      {recorderError && (
        <p className="flex gap-2 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {t(`errors.${recorderError}`)}
        </p>
      )}

      {turnError && (
        <p className="flex gap-2 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {turnError}
        </p>
      )}

      {current && (
        <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-indigo-50">
              <GraduationCap className="size-4 text-indigo-600" aria-hidden="true" />
            </span>
            <div className="space-y-3">
              <p className="leading-relaxed font-medium text-slate-900">
                {current.question}
              </p>

              {current.bullets?.length > 0 && (
                <>
                  <p className="text-xs uppercase tracking-wide text-slate-400">
                    {t('interview.youShouldSay')}
                  </p>
                  <ul className="space-y-1">
                    {current.bullets.map((bullet) => (
                      <li
                        key={bullet}
                        className="flex gap-2 text-sm leading-relaxed text-slate-600"
                      >
                        <span className="mt-2 size-1.5 shrink-0 rounded-full bg-indigo-400" />
                        {bullet}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>

          {isPreparing ? (
            <PrepCountdown
              seconds={current.prepSeconds}
              onDone={() => setIsPreparing(false)}
            />
          ) : (
            <>
              <RecordButton isListening={isListening} disabled={isSubmitting} onToggle={onToggleRecord} />

              <p className="text-center text-xs text-slate-400">
                <span className="font-mono tabular-nums text-slate-500">
                  {formatDuration(elapsedMs)}
                </span>
                {' · '}
                {t('interview.suggested', { n: current.maxSeconds })}
              </p>
            </>
          )}

          <TranscriptArea
            value={transcript}
            interim={interim}
            isListening={isListening}
            onChange={onTranscriptChange}
            onClear={() => onTranscriptChange('')}
          />

          <button
            type="button"
            onClick={onSubmit}
            // Also blocked while a question is in flight: a second submit would
            // file the same answer twice and skip a turn.
            disabled={isListening || isSubmitting || status !== 'answering'}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 font-medium text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {position.turn === position.total
              ? t('interview.lastAnswer')
              : t('interview.nextQuestion')}
            <ArrowRight className="size-4" aria-hidden="true" />
          </button>
        </div>
      )}

      <TurnList turns={turns} total={position.total} />
    </div>
  )
}
