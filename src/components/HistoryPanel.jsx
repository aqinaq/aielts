import { AlertCircle, Cloud, History, Loader2, LogIn, Trash2 } from 'lucide-react'

import { useLanguage } from '../i18n'
import ProgressChart from './ProgressChart'
import MistakePatterns from './MistakePatterns'

const formatDate = (timestamp, lang) =>
  new Date(timestamp).toLocaleDateString(lang === 'kk' ? 'kk-KZ' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })

export default function HistoryPanel({
  entries,
  isLoading,
  error,
  isSignedIn,
  isAuthEnabled,
  onOpen,
  onDelete,
  onClear,
  onSignIn,
}) {
  const { lang, t } = useLanguage()

  return (
    <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 print:hidden">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <History className="size-4 text-slate-400" aria-hidden="true" />
          {t('history.title')}

          {isSignedIn ? (
            <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-normal text-emerald-700">
              <Cloud className="size-3" aria-hidden="true" />
              {t('auth.syncedNote')}
            </span>
          ) : (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-normal text-slate-500">
              {t('auth.guestBadge')}
            </span>
          )}

          {isLoading && (
            <Loader2 className="size-3.5 animate-spin text-slate-400" aria-hidden="true" />
          )}
        </h2>

        {entries.length > 0 && (
          <button
            type="button"
            onClick={() => {
              if (window.confirm(t('history.confirmClear'))) onClear()
            }}
            className="text-xs text-slate-500 transition hover:text-rose-600"
          >
            {t('history.clear')}
          </button>
        )}
      </div>

      {!isSignedIn && isAuthEnabled && (
        <p className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
          {t('auth.guestNote')}
          <button
            type="button"
            onClick={onSignIn}
            className="flex items-center gap-1 font-medium text-indigo-600 transition hover:text-indigo-700"
          >
            <LogIn className="size-3" aria-hidden="true" />
            {t('auth.signIn')}
          </button>
        </p>
      )}

      {error && (
        <p className="flex gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          {t('auth.syncError')}: {error}
        </p>
      )}

      {entries.length === 0 ? (
        <p className="text-sm text-slate-500">{t('history.empty')}</p>
      ) : (
        <>
          <ProgressChart entries={entries} />

          <MistakePatterns entries={entries} />

          <ul className="divide-y divide-slate-100">
            {entries.map((entry) => {
              const delta =
                entry.previousBand == null ? null : entry.band - entry.previousBand
              return (
                <li key={entry.id} className="flex items-center gap-3 py-2.5">
                  <span className="w-12 shrink-0 text-base font-semibold tabular-nums text-slate-900">
                    {entry.band.toFixed(1)}
                  </span>

                  {delta !== null && delta !== 0 && (
                    <span
                      className={`shrink-0 text-xs font-medium tabular-nums ${
                        delta > 0 ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    >
                      {delta > 0 ? '+' : ''}
                      {delta.toFixed(1)}
                    </span>
                  )}

                  <span className="min-w-0 flex-1 truncate text-xs text-slate-500">
                    {t(`mode.${entry.mode}`)} · {formatDate(entry.at, lang)}
                  </span>

                  <button
                    type="button"
                    onClick={() => onOpen(entry)}
                    className="shrink-0 rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-600 transition hover:border-indigo-300 hover:text-indigo-700"
                  >
                    {t('history.open')}
                  </button>

                  <button
                    type="button"
                    onClick={() => onDelete(entry.id)}
                    aria-label={t('history.delete')}
                    className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                  </button>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </section>
  )
}
