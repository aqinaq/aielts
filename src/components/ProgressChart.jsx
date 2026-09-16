import { useLanguage } from '../i18n'

// Categorical slots 1 and 2 of the reference palette, validated against the
// white card surface: worst-pair CVD ΔE 24.7, normal-vision ΔE 33.6, both above
// 3:1 contrast. Kept as constants so a future dark theme swaps them in one place.
const SERIES_COLOR = {
  speak: '#2a78d6',
  write: '#eb6834',
}

const VIEW = { width: 320, height: 140 }
const PAD = { top: 10, right: 30, bottom: 20, left: 26 }
const PLOT = {
  width: VIEW.width - PAD.left - PAD.right,
  height: VIEW.height - PAD.top - PAD.bottom,
}

/** Whole-band domain that frames the data with a little headroom. */
function bandDomain(bands) {
  let min = Math.floor(Math.min(...bands) - 0.5)
  let max = Math.ceil(Math.max(...bands) + 0.5)
  if (max - min < 2) max = min + 2
  return { min: Math.max(0, min), max: Math.min(9, Math.max(max, min + 2)) }
}

export default function ProgressChart({ entries }) {
  const { t } = useLanguage()

  // History is newest-first; a trend reads oldest-first.
  const ordered = entries.filter((entry) => Number.isFinite(entry.band))
    .sort((a, b) => a.at - b.at)

  if (ordered.length < 2) {
    return <p className="text-xs text-slate-400">{t('history.chartHint')}</p>
  }

  const domain = bandDomain(ordered.map((entry) => entry.band))
  const span = domain.max - domain.min

  const xFor = (index) =>
    PAD.left + (PLOT.width * index) / Math.max(1, ordered.length - 1)
  const yFor = (band) =>
    PAD.top + PLOT.height * (1 - (band - domain.min) / span)

  const modes = ['speak', 'write'].filter((mode) =>
    ordered.some((entry) => entry.mode === mode),
  )

  const gridBands = []
  for (let band = domain.min; band <= domain.max; band += 1) gridBands.push(band)

  return (
    <figure className="space-y-2">
      <figcaption className="text-sm font-medium text-slate-700">
        {t('history.chartTitle')}
      </figcaption>

      <svg
        viewBox={`0 0 ${VIEW.width} ${VIEW.height}`}
        className="w-full"
        role="img"
        aria-label={t('history.chartTitle')}
      >
        {gridBands.map((band) => (
          <g key={band}>
            <line
              x1={PAD.left}
              x2={PAD.left + PLOT.width}
              y1={yFor(band)}
              y2={yFor(band)}
              stroke="#e2e8f0"
              strokeWidth="1"
            />
            <text
              x={PAD.left - 6}
              y={yFor(band) + 3.5}
              textAnchor="end"
              fontSize="9"
              fill="#94a3b8"
            >
              {band}
            </text>
          </g>
        ))}

        {modes.map((mode) => {
          const points = ordered
            .map((entry, index) => ({ ...entry, index }))
            .filter((entry) => entry.mode === mode)
          const last = points[points.length - 1]

          return (
            <g key={mode}>
              {points.length > 1 && (
                <polyline
                  points={points
                    .map((point) => `${xFor(point.index)},${yFor(point.band)}`)
                    .join(' ')}
                  fill="none"
                  stroke={SERIES_COLOR[mode]}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {points.map((point) => (
                <circle
                  key={point.id}
                  cx={xFor(point.index)}
                  cy={yFor(point.band)}
                  r="4"
                  fill={SERIES_COLOR[mode]}
                  stroke="#ffffff"
                  strokeWidth="2"
                >
                  {/* Native tooltip; the attempt list below is the table view. */}
                  <title>{`${t(`mode.${mode}`)} — Band ${point.band.toFixed(1)}`}</title>
                </circle>
              ))}

              {/* Selective direct label: only the latest point of each series. */}
              <text
                x={xFor(last.index) + 8}
                y={yFor(last.band) + 3.5}
                fontSize="10"
                fontWeight="600"
                fill="#334155"
              >
                {last.band.toFixed(1)}
              </text>
            </g>
          )
        })}
      </svg>

      {modes.length > 1 && (
        <ul className="flex flex-wrap gap-4">
          {modes.map((mode) => (
            <li key={mode} className="flex items-center gap-1.5 text-xs text-slate-500">
              <span
                aria-hidden="true"
                className="size-2.5 rounded-full"
                style={{ backgroundColor: SERIES_COLOR[mode] }}
              />
              {t(`mode.${mode}`)}
            </li>
          ))}
        </ul>
      )}
    </figure>
  )
}
