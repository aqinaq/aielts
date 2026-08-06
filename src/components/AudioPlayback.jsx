import { Headphones } from 'lucide-react'

import { useLanguage } from '../i18n'

export default function AudioPlayback({ src }) {
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

      <p className="text-xs text-slate-400">{t('audio.note')}</p>
    </div>
  )
}
