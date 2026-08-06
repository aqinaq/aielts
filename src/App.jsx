import { useCallback, useMemo, useState } from 'react'
import { AlertCircle, Keyboard, Mic, Sparkles } from 'lucide-react'

import Header from './components/Header'
import RecordButton from './components/RecordButton'
import TranscriptArea from './components/TranscriptArea'
import TextInput from './components/TextInput'
import TaskInput from './components/TaskInput'
import SpeechMetrics from './components/SpeechMetrics'
import AnalysisResult from './components/AnalysisResult'
import HistoryPanel from './components/HistoryPanel'
import Loader from './components/Loader'
import { useSpeechRecognition } from './hooks/useSpeechRecognition'
import { useAuth } from './hooks/useAuth'
import { useHistory } from './hooks/useHistory'
import { useLanguage } from './i18n'
import { computeSpeechMetrics, formatDuration } from './lib/speechMetrics'

const MIN_WORDS = 8
const MAX_CHARS = 12000
const EMPTY_DRAFT = { text: '', task: '', taskMeta: null }

const countWords = (text) => text.trim().split(/\s+/).filter(Boolean).length

export default function App() {
  const { lang, t } = useLanguage()

  const [mode, setMode] = useState('speak')
  // Speaking and writing keep independent drafts — switching tabs must not
  // carry one over into the other.
  const [drafts, setDrafts] = useState({ speak: EMPTY_DRAFT, write: EMPTY_DRAFT })

  // `result` bundles what was analyzed with the feedback, so opening a past
  // attempt from history renders exactly what it rendered the first time.
  const [result, setResult] = useState(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [apiError, setApiError] = useState(null)

  const auth = useAuth()
  // Guest attempts live in localStorage and are uploaded once the user signs in.
  const history = useHistory(auth.user)

  const draft = drafts[mode]

  const patchDraft = (patch) =>
    setDrafts((current) => ({ ...current, [mode]: { ...current[mode], ...patch } }))

  // Recording only happens in speaking mode, so append there explicitly rather
  // than through the mode-dependent helper.
  const appendChunk = useCallback((chunk) => {
    setDrafts((current) => {
      const previous = current.speak.text
      return {
        ...current,
        speak: {
          ...current.speak,
          text: previous ? `${previous.trimEnd()} ${chunk}` : chunk,
        },
      }
    })
  }, [])

  const {
    isSupported,
    isListening,
    interimTranscript,
    error: speechError,
    elapsedMs,
    chunkTimestamps,
    toggleListening,
    stopListening,
    resetSession,
  } = useSpeechRecognition({ lang: 'en-US', onResult: appendChunk })

  const speechMetrics = useMemo(() => {
    if (mode !== 'speak' || isListening || elapsedMs < 1000) return null
    return computeSpeechMetrics({
      text: drafts.speak.text,
      durationMs: elapsedMs,
      chunkTimestamps,
    })
  }, [mode, isListening, elapsedMs, chunkTimestamps, drafts.speak.text])

  const wordCount = countWords(draft.text)
  const canAnalyze = wordCount >= MIN_WORDS && !isAnalyzing && !isListening

  const switchMode = (nextMode) => {
    if (nextMode === 'write') stopListening()
    setMode(nextMode)
  }

  const clearText = () => {
    patchDraft({ text: '' })
    if (mode === 'speak') resetSession()
    setResult(null)
    setApiError(null)
  }

  const analyze = async () => {
    stopListening()
    setIsAnalyzing(true)
    setApiError(null)
    setResult(null)

    const submittedText = draft.text.trim().slice(0, MAX_CHARS)
    const submittedTask = draft.task.trim().slice(0, 2000)
    const apiMode = mode === 'speak' ? 'speaking' : 'writing'

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          text: submittedText,
          task: submittedTask,
          mode: apiMode,
          lang,
          metrics: speechMetrics,
        }),
      })

      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error ?? t('errors.requestFailed'))

      setResult({
        data: payload,
        text: submittedText,
        mode: apiMode,
        previousBand: history.previousBandFor(mode),
      })
      await history.add({
        mode,
        task: submittedTask,
        text: submittedText,
        result: payload,
        metrics: speechMetrics,
      })
    } catch (error) {
      setApiError(error.message)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const openEntry = (entry) => {
    setApiError(null)
    setResult({
      data: entry.result,
      text: entry.text,
      mode: entry.mode === 'speak' ? 'speaking' : 'writing',
      previousBand: entry.previousBand,
    })
  }

  return (
    <div className="min-h-screen">
      <Header auth={auth} />

      <main className="mx-auto max-w-6xl space-y-8 px-6 py-10">
        <div className="grid gap-8 lg:grid-cols-2 lg:gap-10">
          {/* Input side */}
          <section className="space-y-6 print:hidden">
            <div className="inline-flex rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => switchMode('speak')}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
                  mode === 'speak'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Mic className="size-4" aria-hidden="true" />
                {t('mode.speak')}
              </button>
              <button
                type="button"
                onClick={() => switchMode('write')}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
                  mode === 'write'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Keyboard className="size-4" aria-hidden="true" />
                {t('mode.write')}
              </button>
            </div>

            <TaskInput
              mode={mode}
              value={draft.task}
              meta={draft.taskMeta}
              onChange={(task) => patchDraft({ task })}
              onPick={(task) =>
                patchDraft({
                  task: task.prompt,
                  taskMeta: { minutes: task.minutes, minWords: task.minWords },
                })
              }
            />

            {mode === 'speak' ? (
              <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6">
                {isSupported ? (
                  <>
                    <RecordButton isListening={isListening} onToggle={toggleListening} />

                    <p className="text-center text-xs text-slate-400">
                      {elapsedMs > 0 && (
                        <span className="font-mono tabular-nums text-slate-500">
                          {formatDuration(elapsedMs)}
                        </span>
                      )}
                      {elapsedMs > 0 && ' · '}
                      {t('speech.languageNote')}
                    </p>

                    {speechError && (
                      <p className="flex gap-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
                        <AlertCircle
                          className="mt-0.5 size-4 shrink-0"
                          aria-hidden="true"
                        />
                        {t(`errors.${speechError}`)}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="flex gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                    <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    {t('speech.notSupported')}
                  </p>
                )}

                <TranscriptArea
                  value={draft.text}
                  interim={interimTranscript}
                  isListening={isListening}
                  onChange={(text) => patchDraft({ text })}
                  onClear={clearText}
                />

                {speechMetrics && <SpeechMetrics metrics={speechMetrics} />}
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-white p-6">
                <TextInput
                  value={draft.text}
                  onChange={(text) => patchDraft({ text })}
                  onClear={clearText}
                />
              </div>
            )}

            <div className="space-y-3">
              <button
                type="button"
                onClick={analyze}
                disabled={!canAnalyze}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3.5 font-medium text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-300 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
              >
                <Sparkles className="size-5" aria-hidden="true" />
                {isAnalyzing ? t('actions.analyzing') : t('actions.analyze')}
              </button>

              <p className="text-center text-xs text-slate-400">
                {wordCount} {t('counter.words')}
                {draft.taskMeta &&
                  ` / ${draft.taskMeta.minWords} ${t('task.minWords')}`}
                {wordCount < MIN_WORDS &&
                  ` · ${t('counter.minWords', { n: MIN_WORDS })}`}
              </p>
            </div>
          </section>

          {/* Result side */}
          <section className="lg:sticky lg:top-10 lg:self-start print:col-span-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 print:border-0 print:p-0">
              {isAnalyzing && <Loader label={t('result.loading')} />}

              {!isAnalyzing && apiError && (
                <div className="flex gap-3 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <div>
                    <p className="font-medium">{t('result.errorTitle')}</p>
                    <p className="mt-1">{apiError}</p>
                  </div>
                </div>
              )}

              {!isAnalyzing && !apiError && result && (
                <AnalysisResult
                  result={result.data}
                  text={result.text}
                  mode={result.mode}
                  previousBand={result.previousBand}
                />
              )}

              {!isAnalyzing && !apiError && !result && (
                <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
                  <span className="flex size-12 items-center justify-center rounded-full bg-slate-100">
                    <Sparkles className="size-5 text-slate-400" aria-hidden="true" />
                  </span>
                  <p className="text-sm text-slate-500">{t('result.emptyState')}</p>
                </div>
              )}
            </div>
          </section>
        </div>

        <HistoryPanel
          entries={history.entries}
          isLoading={history.isLoading}
          error={history.error}
          isSignedIn={Boolean(auth.user)}
          isAuthEnabled={auth.isEnabled}
          onOpen={openEntry}
          onDelete={history.remove}
          onClear={history.clear}
          onSignIn={auth.signIn}
        />
      </main>
    </div>
  )
}
