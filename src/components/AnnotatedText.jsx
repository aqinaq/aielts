import { buildSegments } from '../lib/annotate'

export default function AnnotatedText({ text, corrections }) {
  const segments = buildSegments(text, corrections ?? [])
  const hasMarks = segments.some((segment) => segment.type === 'mark')
  if (!hasMarks) return null

  return (
    <p className="whitespace-pre-wrap rounded-xl border border-slate-200 bg-white p-4 text-sm leading-7 text-slate-700">
      {segments.map((segment, index) =>
        segment.type === 'mark' ? (
          <mark
            key={index}
            title={`${segment.correction.original} → ${segment.correction.corrected}`}
            className="rounded bg-amber-100 px-0.5 text-slate-900 decoration-amber-400 underline-offset-4"
          >
            {segment.value}
            <sup className="ml-0.5 text-[0.65rem] font-semibold text-amber-700">
              {segment.number}
            </sup>
          </mark>
        ) : (
          <span key={index}>{segment.value}</span>
        ),
      )}
    </p>
  )
}
