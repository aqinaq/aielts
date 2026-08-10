import { useRef, useState } from 'react'
import { AlertCircle, FileAudio, Upload, X } from 'lucide-react'

import { MAX_SECONDS } from '../lib/audio'
import { useLanguage } from '../i18n'

// Anything the browser has a decoder for works, because `prepareAudio` re-encodes
// whatever it can decode — mp3, m4a, wav, ogg, flac, and the audio track of an
// mp4 in most browsers. The accept list is a hint to the file picker, not a
// gate: an unreadable file is caught on decode and reported then.
const ACCEPT = 'audio/*,.mp3,.m4a,.wav,.ogg,.flac,.aac,.mp4'

// Decoding happens in memory, so a very large file is a way to hang the tab
// rather than a way to get a longer analysis — and past the trim point the
// extra minutes are discarded anyway.
const MAX_BYTES = 60 * 1024 * 1024

const formatSize = (bytes) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`

/**
 * Picking a recording apart from making one.
 *
 * An uploaded file takes exactly the path a Firefox recording takes: there is
 * no live transcript, so the speech endpoint writes one and marks pronunciation
 * from the same pass. Nothing downstream needs to know where the audio came from.
 */
export default function AudioUpload({ file, onSelect, onClear, disabled }) {
  const { t } = useLanguage()
  const inputRef = useRef(null)
  const [error, setError] = useState(null)

  const take = (picked) => {
    if (!picked) return

    if (picked.size > MAX_BYTES) {
      setError(t('upload.tooLarge', { n: formatSize(MAX_BYTES) }))
      return
    }

    setError(null)
    onSelect(picked)
  }

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        onChange={(event) => {
          take(event.target.files?.[0])
          // Cleared so picking the same file twice still fires a change event.
          event.target.value = ''
        }}
      />

      {file ? (
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <FileAudio className="size-4 shrink-0 text-indigo-500" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-700">{file.name}</p>
            <p className="text-xs text-slate-400">{formatSize(file.size)}</p>
          </div>
          <button
            type="button"
            onClick={onClear}
            aria-label={t('upload.remove')}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-200 hover:text-slate-600"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm font-medium text-slate-600 transition hover:border-indigo-400 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Upload className="size-4" aria-hidden="true" />
          {t('upload.button')}
        </button>
      )}

      {error && (
        <p className="flex gap-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}

      <p className="text-xs leading-relaxed text-slate-400">
        {t('upload.hint', { n: Math.floor(MAX_SECONDS / 60) })}
      </p>
    </div>
  )
}
