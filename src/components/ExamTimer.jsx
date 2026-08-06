import { useEffect, useRef, useState } from 'react'
import { Pause, Play, RotateCcw, Timer } from 'lucide-react'

import { useLanguage } from '../i18n'
import { formatDuration } from '../lib/speechMetrics'

export default function ExamTimer({ minutes }) {
  const { t } = useLanguage()
  const totalMs = minutes * 60 * 1000

  const [remainingMs, setRemainingMs] = useState(totalMs)
  const [isRunning, setIsRunning] = useState(false)
  const deadlineRef = useRef(null)

  // A different task means a different allowance — start over.
  useEffect(() => {
    setRemainingMs(totalMs)
    setIsRunning(false)
    deadlineRef.current = null
  }, [totalMs])

  useEffect(() => {
    if (!isRunning) return undefined

    deadlineRef.current = Date.now() + remainingMs
    const interval = setInterval(() => {
      const left = deadlineRef.current - Date.now()
      if (left <= 0) {
        setRemainingMs(0)
        setIsRunning(false)
      } else {
        setRemainingMs(left)
      }
    }, 250)

    return () => clearInterval(interval)
    // `remainingMs` is read once to set the deadline; re-running on every tick
    // would reset the interval continuously.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning])

  const isDone = remainingMs === 0
  const isLow = remainingMs > 0 && remainingMs < 60 * 1000

  const reset = () => {
    setIsRunning(false)
    setRemainingMs(totalMs)
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl bg-slate-50 px-4 py-3">
      <Timer className="size-4 text-slate-400" aria-hidden="true" />
      <span className="text-sm text-slate-500">{t('timer.label')}</span>

      <span
        aria-live="polite"
        className={`ml-auto font-mono text-lg tabular-nums ${
          isDone ? 'text-rose-600' : isLow ? 'text-amber-600' : 'text-slate-900'
        }`}
      >
        {isDone ? t('timer.done') : formatDuration(remainingMs)}
      </span>

      <button
        type="button"
        onClick={() => setIsRunning((running) => !running)}
        disabled={isDone}
        className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-300 disabled:opacity-40"
      >
        {isRunning ? (
          <Pause className="size-3.5" aria-hidden="true" />
        ) : (
          <Play className="size-3.5" aria-hidden="true" />
        )}
        {isRunning ? t('timer.pause') : t('timer.start')}
      </button>

      <button
        type="button"
        onClick={reset}
        className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-300"
      >
        <RotateCcw className="size-3.5" aria-hidden="true" />
        {t('timer.reset')}
      </button>
    </div>
  )
}
