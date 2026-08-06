import { Trash2 } from 'lucide-react'

import { useLanguage } from '../i18n'

export default function TranscriptArea({
  value,
  interim,
  isListening,
  onChange,
  onClear,
}) {
  const { t } = useLanguage()
  const isEmpty = !value && !interim

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label htmlFor="transcript" className="text-sm font-medium text-slate-700">
          {t('transcript.label')}
        </label>
        {value && !isListening && (
          <button
            type="button"
            onClick={onClear}
            className="flex items-center gap-1 text-xs text-slate-500 transition hover:text-rose-600"
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
            {t('actions.clear')}
          </button>
        )}
      </div>

      {/* While listening the box is read-only so incoming words can't fight with
          the caret; editing is enabled the moment recording stops. */}
      {isListening ? (
        <div
          aria-live="polite"
          className="min-h-40 w-full rounded-xl border border-rose-200 bg-rose-50/40 p-4 text-slate-800"
        >
          {isEmpty ? (
            <span className="text-slate-400">{t('transcript.empty')}</span>
          ) : (
            <p className="whitespace-pre-wrap leading-relaxed">
              {value}
              {interim && <span className="text-slate-400"> {interim}</span>}
            </p>
          )}
        </div>
      ) : (
        <textarea
          id="transcript"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={7}
          placeholder={t('transcript.placeholder')}
          className="min-h-40 w-full resize-y rounded-xl border border-slate-200 bg-white p-4 leading-relaxed text-slate-800 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-100"
        />
      )}
    </div>
  )
}
