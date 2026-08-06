import { Mic, Square } from 'lucide-react'

import { useLanguage } from '../i18n'

export default function RecordButton({ isListening, disabled, onToggle }) {
  const { t } = useLanguage()

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative flex size-24 items-center justify-center">
        {isListening && (
          <>
            <span className="pulse-ring absolute inset-0 rounded-full bg-rose-400" />
            <span className="pulse-ring-delayed absolute inset-0 rounded-full bg-rose-400" />
          </>
        )}
        <button
          type="button"
          onClick={onToggle}
          disabled={disabled}
          aria-pressed={isListening}
          aria-label={isListening ? t('speech.stopLabel') : t('speech.startLabel')}
          className={`relative flex size-20 items-center justify-center rounded-full text-white shadow-lg transition focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-300 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none ${
            isListening
              ? 'bg-rose-500 hover:bg-rose-600'
              : 'bg-indigo-600 hover:bg-indigo-700'
          }`}
        >
          {isListening ? (
            <Square className="size-7 fill-current" aria-hidden="true" />
          ) : (
            <Mic className="size-8" aria-hidden="true" />
          )}
        </button>
      </div>

      <p className="text-sm text-slate-500">
        {isListening ? t('speech.listening') : t('speech.start')}
      </p>
    </div>
  )
}
