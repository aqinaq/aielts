import { ArrowRight, Target } from 'lucide-react'

import { useLanguage } from '../i18n'
import { aggregateMistakes, totalCorrections } from '../lib/mistakes'

export default function MistakePatterns({ entries }) {
  const { t } = useLanguage()

  const patterns = aggregateMistakes(entries)
  const total = totalCorrections(entries)

  // With one attempt there is no "recurring" to speak of yet.
  if (entries.length < 2 || patterns.length === 0 || total === 0) return null

  return (
    <section className="space-y-3">
      <div>
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Target className="size-4 text-indigo-500" aria-hidden="true" />
          {t('patterns.title')}
        </h3>
        <p className="mt-1 text-xs text-slate-400">{t('patterns.hint')}</p>
      </div>

      <ul className="space-y-2">
        {patterns.map((pattern) => (
          <li
            key={pattern.category}
            className="space-y-2 rounded-xl border border-slate-200 bg-white p-3"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-sm font-medium text-slate-800">
                {t(`mistakes.${pattern.category}`)}
              </span>
              <span className="text-xs tabular-nums text-slate-500">
                {t('patterns.occurrences', { n: pattern.total })} ·{' '}
                {t('patterns.inAttempts', { n: pattern.attempts })}
              </span>
            </div>

            {/* Share of all corrections, so a big number on a long history
                still reads as "this is the main thing to fix". */}
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-indigo-500"
                style={{ width: `${Math.round((pattern.total / total) * 100)}%` }}
              />
            </div>

            <ul className="flex flex-wrap gap-x-3 gap-y-1">
              {pattern.examples.map((example, index) => (
                <li
                  key={`${example.original}-${index}`}
                  className="flex items-center gap-1 text-xs text-slate-500"
                >
                  <span className="text-rose-600 line-through decoration-rose-300">
                    {example.original}
                  </span>
                  <ArrowRight className="size-3 text-slate-300" aria-hidden="true" />
                  <span className="text-emerald-700">{example.corrected}</span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  )
}
