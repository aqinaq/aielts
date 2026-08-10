import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  GraduationCap,
  Keyboard,
  Mic,
  RotateCcw,
  Sparkles,
  Wand2,
} from 'lucide-react'

import Chart from './components/Chart'
import Header from './components/Header'
import RecordButton from './components/RecordButton'
import TranscriptArea from './components/TranscriptArea'
import AudioPlayback from './components/AudioPlayback'
import AudioUpload from './components/AudioUpload'
import TextInput from './components/TextInput'
import TaskInput from './components/TaskInput'
import SpeechMetrics from './components/SpeechMetrics'
import AnalysisResult from './components/AnalysisResult'
import HistoryPanel from './components/HistoryPanel'
import Interview from './components/Interview'
import Loader from './components/Loader'
import { useSpeechRecognition } from './hooks/useSpeechRecognition'
import { useAudioRecorder } from './hooks/useAudioRecorder'
import { useAuth } from './hooks/useAuth'
import { useHistory } from './hooks/useHistory'
import { useInterview } from './hooks/useInterview'
import { useLanguage } from './i18n'
import { CHARTS, describeChart } from './lib/charts'
import { buildSubmission, longestRecording } from './lib/interview'
import { computeSpeechMetrics, formatDuration } from './lib/speechMetrics'
import { runAnalysis } from './lib/runAnalysis'
import { SAMPLE_RESULT, SAMPLE_TEXT } from './lib/sampleResult'

const MIN_WORDS = 8
const EMPTY_DRAFT = { text: '', task: '', taskMeta: null }

const countWords = (text) => text.trim().split(/\s+/).filter(Boolean).length

export default function App() {
  const { lang, t } = useLanguage()

  const [mode, setMode] = useState('speak')
  // Each mode keeps an independent draft — switching tabs must not carry one
  // over into another. The interview draft holds only the turn in progress; the
  // finished turns live in the interview session itself.
  const [drafts, setDrafts] = useState({
    speak: EMPTY_DRAFT,
    write: EMPTY_DRAFT,
    interview: EMPTY_DRAFT,
  })

  // `result` bundles what was analyzed with the feedback, so opening a past
  // attempt from history renders exactly what it rendered the first time.
  const [result, setResult] = useState(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [apiError, setApiError] = useState(null)

  const auth = useAuth()
  // Guest attempts live in localStorage and are uploaded once the user signs in.
  const history = useHistory(auth.user)

  const draft = drafts[mode]

  // Academic Task 1 ships with a chart to describe. Holding only its id in the
  // draft keeps the data out of history entries, which store the prompt text.
  const chart = draft.taskMeta?.chartId ? CHARTS[draft.taskMeta.chartId] : null

  const patchDraft = (patch) =>
    setDrafts((current) => ({ ...current, [mode]: { ...current[mode], ...patch } }))

  // Recognition results arrive from a listener that outlives any one render, so
  // the target mode is read through a ref rather than captured in the closure.
  const modeRef = useRef(mode)
  useEffect(() => {
    modeRef.current = mode
  })

  const appendChunk = useCallback((chunk) => {
    const target = modeRef.current === 'interview' ? 'interview' : 'speak'
    setDrafts((current) => {
      const previous = current[target].text
      return {
        ...current,
        [target]: {
          ...current[target],
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
    startListening,
    stopListening,
    resetSession,
  } = useSpeechRecognition({ lang: 'en-US', onResult: appendChunk })

  const recorder = useAudioRecorder()
  const interview = useInterview(lang)

  // An uploaded file stands in for a recording. Only one can be the answer, so
  // choosing a file clears the live transcript: the analysis then takes the
  // transcribe-first path and grades what is actually in the file, rather than
  // pairing someone else's audio with whatever was left in the box.
  const [uploaded, setUploaded] = useState(null)

  // Transcription and audio capture start and stop together — the recording is
  // only useful next to the transcript it produced.
  // Resolves with the finished recording. Recognition can end on its own —
  // Chrome stops listening after a pause — so `isListening` going false is not
  // proof the recorder has flushed its blob yet; callers that need the audio
  // must await this rather than read the previous render's value.
  const stopCapture = useCallback(() => {
    stopListening()
    return recorder.stop()
  }, [recorder, stopListening])

  const toggleCapture = useCallback(() => {
    if (isListening) {
      stopCapture()
      return
    }
    recorder.reset()
    recorder.start()
    startListening()
  }, [isListening, recorder, startListening, stopCapture])

  const speechMetrics = useMemo(() => {
    if (mode !== 'speak' || isListening || elapsedMs < 1000) return null
    return computeSpeechMetrics({
      text: drafts.speak.text,
      durationMs: elapsedMs,
      chunkTimestamps,
    })
  }, [mode, isListening, elapsedMs, chunkTimestamps, drafts.speak.text])

  const wordCount = countWords(draft.text)

  // A recording is enough on its own: where Web Speech is missing (Firefox,
  // Safari) the transcript box stays empty no matter how long you talk, and
  // gating on word count alone would lock those browsers out of the app.
  const hasRecording = mode === 'speak' && Boolean(recorder.audioBlob || uploaded)
  const canAnalyze =
    (wordCount >= MIN_WORDS || hasRecording) && !isAnalyzing && !isListening

  const switchMode = (nextMode) => {
    // Leaving a mode mid-recording would leave the microphone open and feed
    // recognition results into a draft nobody is looking at.
    if (nextMode !== mode) stopCapture()
    setMode(nextMode)
  }

  /** Files the current turn and clears the desk for the next question. */
  const submitTurn = async () => {
    const audioBlob = await stopCapture()
    const answer = drafts.interview.text
    const durationMs = elapsedMs

    patchDraft({ text: '' })
    resetSession()
    recorder.reset()

    await interview.submit({ answer, audioBlob, durationMs })
  }

  const clearText = () => {
    patchDraft({ text: '' })
    if (mode === 'speak') {
      resetSession()
      recorder.reset()
      setUploaded(null)
    }
    setResult(null)
    setApiError(null)
  }

  const analyze = async () => {
    // Awaited: pressing analyze while still recording must grade the audio just
    // captured, not whatever the previous render happened to hold.
    const captured = await stopCapture()
    setIsAnalyzing(true)
    setApiError(null)
    setResult(null)

    // The chart's figures ride along with the prompt. Without them the grader
    // can only judge whether the description reads well; with them it can catch
    // the reporting errors that Task Achievement actually turns on.
    const submittedTask = [draft.task.trim(), describeChart(chart)]
      .filter(Boolean)
      .join('\n\n')
      .slice(0, 2000)
    const apiMode = mode === 'speak' ? 'speaking' : 'writing'

    try {
      const outcome = await runAnalysis({
        text: draft.text,
        task: submittedTask,
        mode: apiMode,
        lang,
        // An uploaded file wins over the microphone: it is the more deliberate
        // choice of the two, and its transcript is what gets graded.
        audioBlob: mode === 'speak' ? (uploaded ?? captured) : null,
        elapsedMs,
        chunkTimestamps,
        hasData: Boolean(chart),
      })

      // Where Gemini supplied the transcript, show it: it is the text the
      // corrections were written against, so the highlights only line up if the
      // box holds the same words.
      if (outcome.text !== draft.text.trim()) patchDraft({ text: outcome.text })

      setResult({
        data: outcome.data,
        text: outcome.text,
        mode: apiMode,
        previousBand: history.previousBandFor(mode),
        notes: outcome.notes,
      })
      await history.add({
        mode,
        task: submittedTask,
        text: outcome.text,
        result: outcome.data,
        metrics: outcome.metrics,
      })
    } catch (error) {
      // `runAnalysis` throws bare keys for the cases it detects itself; anything
      // from the endpoints is already a translated sentence.
      const known = ['noInput', 'noSpeechHeard', 'audioUnreadable']
      setApiError(
        known.includes(error.message)
          ? t(`errors.${error.message}`)
          : (error.message ?? t('errors.requestFailed')),
      )
    } finally {
      setIsAnalyzing(false)
    }
  }

  /**
   * Grades a finished interview as one performance, which is how IELTS awards
   * a Speaking band — the eleven answers are marked together, not separately.
   */
  const analyzeInterview = async () => {
    setIsAnalyzing(true)
    setApiError(null)
    setResult(null)

    const submission = buildSubmission(interview.turns, interview.scope)
    const longest = longestRecording(interview.turns)
    const totalMs = interview.turns.reduce((sum, turn) => sum + (turn.durationMs ?? 0), 0)

    try {
      const outcome = await runAnalysis({
        ...submission,
        mode: 'speaking',
        lang,
        audioBlob: longest?.audioBlob ?? null,
        elapsedMs: totalMs,
        chunkTimestamps: [],
        // Only the longest answer is uploaded, so the waveform describes one
        // turn while the transcript covers all of them.
        audioCoversAllSpeech: false,
      })

      setResult({
        data: outcome.data,
        text: outcome.text,
        mode: 'speaking',
        previousBand: history.previousBandFor('interview'),
        notes: outcome.notes,
      })
      await history.add({
        mode: 'interview',
        task: submission.task,
        text: outcome.text,
        result: outcome.data,
        metrics: outcome.metrics,
      })
    } catch (error) {
      const known = ['noInput', 'noSpeechHeard', 'audioUnreadable']
      setApiError(
        known.includes(error.message)
          ? t(`errors.${error.message}`)
          : (error.message ?? t('errors.requestFailed')),
      )
    } finally {
      setIsAnalyzing(false)
    }
  }

  // ⌘/Ctrl + Enter submits from anywhere, including inside the textareas.
  const shortcut = useRef({ analyze, canAnalyze })
  useEffect(() => {
    shortcut.current = { analyze, canAnalyze }
  })
  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault()
        if (shortcut.current.canAnalyze) shortcut.current.analyze()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const openEntry = (entry) => {
    setApiError(null)
    setResult({
      data: entry.result,
      text: entry.text,
      mode: entry.mode === 'speak' ? 'speaking' : 'writing',
      previousBand: entry.previousBand,
    })
  }

  const showSample = () => {
    setApiError(null)
    setResult({
      data: SAMPLE_RESULT,
      text: SAMPLE_TEXT,
      mode: 'speaking',
      previousBand: null,
      isSample: true,
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
              <button
                type="button"
                onClick={() => switchMode('interview')}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
                  mode === 'interview'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <GraduationCap className="size-4" aria-hidden="true" />
                {t('mode.interview')}
              </button>
            </div>

            {mode === 'interview' ? (
              <>
                <Interview
                  status={interview.status}
                  current={interview.current}
                  turns={interview.turns}
                  error={interview.error}
                  scope={interview.scope}
                  isSupported={isSupported || recorder.isSupported}
                  isListening={isListening}
                  elapsedMs={elapsedMs}
                  transcript={drafts.interview.text}
                  interim={interimTranscript}
                  onStart={interview.start}
                  onToggleRecord={toggleCapture}
                  onTranscriptChange={(text) => patchDraft({ text })}
                  onSubmit={submitTurn}
                  onRetry={interview.retry}
                  onFinishEarly={interview.finishEarly}
                />

                {interview.status === 'finished' && (
                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={analyzeInterview}
                      disabled={isAnalyzing}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3.5 font-medium text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      <Sparkles className="size-5" aria-hidden="true" />
                      {isAnalyzing ? t('actions.analyzing') : t('interview.grade')}
                    </button>
                    <button
                      type="button"
                      onClick={interview.reset}
                      className="w-full rounded-xl border border-slate-200 px-6 py-2.5 text-sm font-medium text-slate-600 transition hover:border-slate-300"
                    >
                      {t('interview.restart')}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <>
            <TaskInput
              mode={mode}
              value={draft.task}
              meta={draft.taskMeta}
              onChange={(task) => patchDraft({ task })}
              onPick={(task) =>
                patchDraft({
                  task: task.prompt,
                  taskMeta: {
                    minutes: task.minutes,
                    minWords: task.minWords,
                    chartId: task.chartId ?? null,
                  },
                })
              }
            />

            {chart && <Chart chart={chart} />}

            {mode === 'speak' ? (
              <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6">
                {isSupported ? (
                  <>
                    <RecordButton isListening={isListening} onToggle={toggleCapture} />

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

                {!isListening && !uploaded && <AudioPlayback src={recorder.audioUrl} />}

                {speechMetrics && !uploaded && <SpeechMetrics metrics={speechMetrics} />}

                <div className="border-t border-slate-100 pt-5">
                  <AudioUpload
                    file={uploaded}
                    disabled={isListening}
                    onSelect={(file) => {
                      stopCapture()
                      setUploaded(file)
                      // The file's own transcript replaces whatever is here.
                      patchDraft({ text: '' })
                      resetSession()
                      recorder.reset()
                    }}
                    onClear={() => setUploaded(null)}
                  />
                </div>
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
                {wordCount < MIN_WORDS
                  ? ` · ${t('counter.minWords', { n: MIN_WORDS })}`
                  : ` · ${t('actions.shortcutHint')}`}
              </p>
            </div>
              </>
            )}
          </section>

          {/* Result side */}
          <section className="lg:sticky lg:top-10 lg:self-start print:col-span-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 print:border-0 print:p-0">
              {isAnalyzing && (
                <Loader label={t('result.loading')} hint={t('result.loadingHint')} />
              )}

              {!isAnalyzing && apiError && (
                <div className="space-y-3 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">
                  <div className="flex gap-3">
                    <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    <div>
                      <p className="font-medium">{t('result.errorTitle')}</p>
                      <p className="mt-1">{apiError}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={analyze}
                    disabled={!canAnalyze}
                    className="flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-medium text-rose-700 transition hover:border-rose-300 disabled:opacity-50"
                  >
                    <RotateCcw className="size-3.5" aria-hidden="true" />
                    {t('actions.retry')}
                  </button>
                </div>
              )}

              {!isAnalyzing && !apiError && result && (
                <AnalysisResult
                  result={result.data}
                  text={result.text}
                  mode={result.mode}
                  previousBand={result.previousBand}
                  notes={result.notes}
                  isSample={result.isSample}
                />
              )}

              {!isAnalyzing && !apiError && !result && (
                <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
                  <span className="flex size-12 items-center justify-center rounded-full bg-slate-100">
                    <Sparkles className="size-5 text-slate-400" aria-hidden="true" />
                  </span>
                  <p className="text-sm text-slate-500">{t('result.emptyState')}</p>

                  {/* Lets a first-time visitor see what the output looks like
                      without an API key or an account. */}
                  <button
                    type="button"
                    onClick={showSample}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-indigo-300 hover:text-indigo-700"
                  >
                    <Wand2 className="size-3.5" aria-hidden="true" />
                    {t('sample.button')}
                  </button>
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
