import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'

/**
 * Analysis takes tens of seconds, so show real elapsed time rather than a bare
 * spinner — a counter that is actually moving reads as "working", where a static
 * spinner reads as "stuck".
 */
export default function Loader({ label, hint }) {
  const [seconds, setSeconds] = useState(0)

  useEffect(() => {
    const started = Date.now()
    const interval = setInterval(
      () => setSeconds(Math.floor((Date.now() - started) / 1000)),
      1000,
    )
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-500">
      <Loader2 className="size-8 animate-spin text-indigo-600" aria-hidden="true" />
      <p className="text-sm" aria-live="polite">
        {label}
      </p>
      <p className="text-xs text-slate-400">
        <span className="font-mono tabular-nums">{seconds}s</span>
        {hint && ` · ${hint}`}
      </p>
    </div>
  )
}
