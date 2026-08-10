import {
  ArrowRight,
  CheckCircle2,
  Info,
  Lightbulb,
  PenLine,
  Printer,
  TrendingDown,
  TrendingUp,
  Volume2,
} from 'lucide-react'

import { useLanguage } from '../i18n'
import AnnotatedText from './AnnotatedText'

// Feedback fields arrive as { kk, en } so switching the site language never
// needs another API round trip.
const pick = (field, lang) => field?.[lang] ?? field?.en ?? ''

const CRITERION_ORDER = [
  'task_achievement',
  'task_response',
  'fluency_coherence',
  'coherence_cohesion',
  'lexical_resource',
  'grammatical_range',
  // Last, matching the order the official speaking descriptors list. Only
  // present when the recording reached the speech endpoint.
  'pronunciation',
]

const bandTheme = (band) => {
  if (band >= 8) return { bar: 'bg-emerald-500', text: 'text-emerald-600', emoji: '🎯' }
  if (band >= 7) return { bar: 'bg-lime-500', text: 'text-lime-600', emoji: '👍' }
  if (band >= 6) return { bar: 'bg-amber-500', text: 'text-amber-600', emoji: '💪' }
  return { bar: 'bg-rose-500', text: 'text-rose-600', emoji: '🌱' }
}

function BandBar({ label, band }) {
  const theme = bandTheme(band)
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-slate-700">{label}</span>
        <span className={`text-sm font-semibold tabular-nums ${theme.text}`}>
          {band.toFixed(1)}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-[width] duration-700 ${theme.bar}`}
          style={{ width: `${Math.max(0, Math.min(band, 9)) * (100 / 9)}%` }}
        />
      </div>
    </div>
  )
}

function List({ icon: Icon, title, items, tone, lang }) {
  if (!items?.length) return null
  return (
    <section className="space-y-2">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        <Icon className={`size-4 ${tone}`} aria-hidden="true" />
        {title}
      </h3>
      <ul className="space-y-1.5">
        {items.map((item, index) => (
          <li
            key={item.en ?? index}
            className="flex gap-2 text-sm leading-relaxed text-slate-600"
          >
            <span
              className={`mt-2 size-1.5 shrink-0 rounded-full ${tone.replace('text-', 'bg-')}`}
            />
            {pick(item, lang)}
          </li>
        ))}
      </ul>
    </section>
  )
}

export default function AnalysisResult({
  result,
  text,
  mode,
  previousBand,
  notes = [],
  isSample = false,
}) {
  const { lang, t } = useLanguage()
  const theme = bandTheme(result.overall_band)
  const delta = previousBand == null ? null : result.overall_band - previousBand
  const hasPronunciation = Boolean(result.criteria?.pronunciation)

  return (
    <div className="space-y-8">
      {isSample && (
        <p className="flex flex-wrap items-center gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
          <span className="rounded-full bg-amber-200 px-2 py-0.5 font-semibold text-amber-900">
            {t('sample.badge')}
          </span>
          {t('sample.note')}
        </p>
      )}
      <div className="flex flex-wrap items-start gap-6">
        <div className="flex flex-col items-center">
          <span className="text-xs uppercase tracking-wide text-slate-400">
            {t('result.band')}
          </span>
          <span className={`text-6xl font-semibold tabular-nums ${theme.text}`}>
            {result.overall_band.toFixed(1)}
          </span>
        </div>

        <div className="min-w-48 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-indigo-50 px-3 py-1 text-sm font-medium text-indigo-700">
              CEFR {result.level}
            </span>
            <span aria-hidden="true">{theme.emoji}</span>

            {delta === null ? (
              <span className="text-xs text-slate-400">{t('result.firstAttempt')}</span>
            ) : (
              delta !== 0 && (
                <span
                  className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium tabular-nums ${
                    delta > 0
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-rose-50 text-rose-700'
                  }`}
                >
                  {delta > 0 ? (
                    <TrendingUp className="size-3.5" aria-hidden="true" />
                  ) : (
                    <TrendingDown className="size-3.5" aria-hidden="true" />
                  )}
                  {delta > 0 ? '+' : ''}
                  {delta.toFixed(1)} · {t('result.comparedTo')}
                </span>
              )
            )}
          </div>

          <p className="text-sm leading-relaxed text-slate-600">
            {pick(result.summary, lang)}
          </p>
        </div>

        <button
          type="button"
          onClick={() => window.print()}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-indigo-300 hover:text-indigo-700 print:hidden"
        >
          <Printer className="size-3.5" aria-hidden="true" />
          {t('actions.print')}
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {CRITERION_ORDER.map((key) => {
          const criterion = result.criteria?.[key]
          if (!criterion) return null
          return (
            <div
              key={key}
              className="space-y-2 rounded-xl border border-slate-200 bg-white p-4"
            >
              <BandBar label={t(`criteria.${key}`)} band={criterion.band} />
              <p className="text-sm leading-relaxed text-slate-600">
                {pick(criterion.comment, lang)}
              </p>
            </div>
          )
        })}
      </div>

      {result.mispronounced?.length > 0 && (
        <section className="space-y-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Volume2 className="size-4 text-violet-500" aria-hidden="true" />
            {t('result.mispronounced')}
          </h3>
          <ul className="space-y-2">
            {result.mispronounced.map((item, index) => (
              <li
                key={`${item.word}-${index}`}
                className="rounded-xl border border-slate-200 bg-white p-3"
              >
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="rounded bg-rose-50 px-2 py-0.5 text-rose-700">
                    {item.heard}
                  </span>
                  <ArrowRight className="size-3.5 text-slate-400" aria-hidden="true" />
                  <span className="rounded bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700">
                    {item.word}
                  </span>
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                  {pick(item.note, lang)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Caveats about the audio, and the reason pronunciation is missing when
          it is — a criterion silently absent from a speaking result is worse
          than one explained. A trim is worth saying even when everything
          worked, because it changes what was assessed. */}
      {notes.includes('audioTrimmed') && (
        <p className="flex gap-1.5 text-xs leading-relaxed text-amber-700">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          {t('result.audioTrimmed')}
        </p>
      )}

      {mode === 'speaking' && !hasPronunciation && (
        <p className="flex gap-1.5 text-xs leading-relaxed text-slate-400">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          {notes.includes('pronunciationFailed')
            ? t('result.pronunciationFailed')
            : t('result.pronunciationNote')}
        </p>
      )}

      <List
        icon={CheckCircle2}
        title={t('result.strengths')}
        items={result.strengths}
        tone="text-emerald-500"
        lang={lang}
      />

      <List
        icon={TrendingUp}
        title={t('result.improvements')}
        items={result.improvements}
        tone="text-amber-500"
        lang={lang}
      />

      {result.corrections?.length > 0 && (
        <section className="space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <PenLine className="size-4 text-indigo-500" aria-hidden="true" />
            {t('result.corrections')}
          </h3>

          {text && <AnnotatedText text={text} corrections={result.corrections} />}

          <ol className="space-y-3">
            {result.corrections.map((correction, index) => (
              <li
                key={`${correction.original}-${index}`}
                className="rounded-xl border border-slate-200 bg-white p-4"
              >
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-xs font-semibold text-slate-400">
                    {index + 1}
                  </span>
                  <span className="rounded bg-rose-50 px-2 py-0.5 text-rose-700 line-through decoration-rose-300">
                    {correction.original}
                  </span>
                  <ArrowRight className="size-3.5 text-slate-400" aria-hidden="true" />
                  <span className="rounded bg-emerald-50 px-2 py-0.5 text-emerald-700">
                    {correction.corrected}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {pick(correction.explanation, lang)}
                </p>
              </li>
            ))}
          </ol>
        </section>
      )}

      {result.next_step && (
        <section className="flex gap-3 rounded-xl bg-indigo-50 p-4">
          <Lightbulb
            className="mt-0.5 size-4 shrink-0 text-indigo-600"
            aria-hidden="true"
          />
          <div>
            <h3 className="text-sm font-semibold text-indigo-900">
              {t('result.nextStep')}
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-indigo-800">
              {pick(result.next_step, lang)}
            </p>
          </div>
        </section>
      )}
    </div>
  )
}
