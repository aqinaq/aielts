import { Gauge, Info, Repeat, Timer, Wind } from 'lucide-react'

import { useLanguage } from '../i18n'
import { formatDuration } from '../lib/speechMetrics'

function Stat({ icon: Icon, label, value, hint, tone = 'text-slate-900' }) {
  return (
    <div className="space-y-1 rounded-xl bg-slate-50 p-3">
      <div className="flex items-center gap-1.5 text-xs text-slate-500">
        <Icon className="size-3.5" aria-hidden="true" />
        {label}
      </div>
      <div className={`text-xl font-semibold tabular-nums ${tone}`}>{value}</div>
      {hint && <div className="text-xs text-slate-400">{hint}</div>}
    </div>
  )
}

export default function SpeechMetrics({ metrics }) {
  const { t } = useLanguage()
  if (!metrics) return null

  const { wordsPerMinute } = metrics
  // 120-150 wpm is the usual comfortable range for an exam answer.
  const paceTone =
    wordsPerMinute == null
      ? 'text-slate-400'
      : wordsPerMinute >= 110 && wordsPerMinute <= 165
        ? 'text-emerald-600'
        : 'text-amber-600'

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-slate-700">{t('metrics.title')}</h3>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          icon={Timer}
          label={t('metrics.duration')}
          value={formatDuration(metrics.durationMs)}
        />
        <Stat
          icon={Gauge}
          label={t('metrics.wpm')}
          value={wordsPerMinute ?? '—'}
          hint={t('metrics.wpmTarget')}
          tone={paceTone}
        />
        <Stat
          icon={Wind}
          label={t('metrics.fillers')}
          value={metrics.fillerCount}
          hint={
            metrics.fillerBreakdown.length > 0
              ? metrics.fillerBreakdown
                  .slice(0, 2)
                  .map((entry) => `${entry.phrase} ×${entry.count}`)
                  .join(', ')
              : undefined
          }
          tone={metrics.fillerCount > 6 ? 'text-amber-600' : 'text-slate-900'}
        />
        <Stat
          icon={Repeat}
          label={t('metrics.repeats')}
          value={metrics.repeatCount}
          hint={`${t('metrics.pauses')}: ${metrics.longPauses}`}
        />
      </div>

      <p className="flex gap-1.5 text-xs leading-relaxed text-slate-400">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        {t('metrics.note')}
      </p>
    </div>
  )
}
