import { Headphones, Trash2 } from 'lucide-react'

import { useLanguage } from '../i18n'

export default function AudioPlayback({ src, onDelete }) {
  const { t } = useLanguage()
  if (!src) return null

  return (
    <div className="space-y-2">
      <h3 className="flex items-center gap-2 text-sm font-medium text-slate-700">
        <Headphones className="size-4 text-slate-400" aria-hidden="true" />
        {t('audio.label')}
      </h3>

      {/* The native player is deliberate: it is keyboard accessible, has scrubbing
          and speed control for free, and matches what people expect. */}
      <audio src={src} controls className="w-full" />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-400">{t('audio.note')}</p>
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="flex shrink-0 items-center gap-1 text-xs font-medium text-rose-600 hover:text-rose-700"
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
            {t('audio.delete')}
          </button>
        )}
      </div>
    </div>
  )
}
