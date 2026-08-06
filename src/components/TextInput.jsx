import { Trash2 } from 'lucide-react'

import { useLanguage } from '../i18n'

export default function TextInput({ value, onChange, onClear }) {
  const { t } = useLanguage()

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label htmlFor="essay" className="text-sm font-medium text-slate-700">
          {t('essay.label')}
        </label>
        {value && (
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

      <textarea
        id="essay"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={12}
        placeholder={t('essay.placeholder')}
        className="min-h-64 w-full resize-y rounded-xl border border-slate-200 bg-white p-4 leading-relaxed text-slate-800 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-100"
      />
    </div>
  )
}
