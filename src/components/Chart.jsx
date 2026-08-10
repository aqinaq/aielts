import { SERIES_COLORS, allValues, niceTicks, spreadLabels } from '../lib/charts'

// Exam charts, drawn as inline SVG — no chart library, matching the approach
// already used for the progress graph.
//
// The look follows the house data-viz rules: 2px lines, bars capped at 24px
// with a rounded data-end, hairline solid gridlines, and direct labels only
// where they earn their place. One rule matters more here than in a dashboard:
// the candidate has to read values off this chart the way they would off a
// printed exam paper, so the axis ticks and gridlines carry every number that
// is not directly labelled, and nothing depends on hovering.

const INK = { primary: '#0b0b0b', secondary: '#52514e', muted: '#898781' }
const GRID = '#e1e0d9'
const AXIS = '#c3c2b7'
const SURFACE = '#ffffff'

function Legend({ series }) {
  // A single series needs no legend: the caption already names what is plotted.
  if (series.length < 2) return null

  return (
    <ul className="mt-3 flex flex-wrap justify-center gap-x-5 gap-y-2">
      {series.map((entry, index) => (
        <li key={entry.name} className="flex items-center gap-2 text-xs text-slate-600">
          <span
            aria-hidden="true"
            className="size-2.5 shrink-0 rounded-full"
            style={{ background: SERIES_COLORS[index % SERIES_COLORS.length] }}
          />
          {entry.name}
        </li>
      ))}
    </ul>
  )
}

function LineChart({ chart }) {
  const width = 640
  const height = 320
  // Right padding is the gutter the end labels sit in — just wide enough for a
  // number, so the plot itself keeps the rest.
  const pad = { top: 16, right: 52, bottom: 36, left: 44 }

  const ticks = niceTicks(Math.max(...allValues(chart)))
  const maxTick = ticks[ticks.length - 1]

  const plotWidth = width - pad.left - pad.right
  const plotHeight = height - pad.top - pad.bottom

  const x = (index) =>
    pad.left + (index / (chart.xLabels.length - 1)) * plotWidth
  const y = (value) => pad.top + plotHeight - (value / maxTick) * plotHeight

  const endLabelY = spreadLabels(
    chart.series.map((series) => y(series.values[series.values.length - 1])),
  )

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img">
      {ticks.map((tick) => (
        <g key={tick}>
          <line
            x1={pad.left}
            x2={pad.left + plotWidth}
            y1={y(tick)}
            y2={y(tick)}
            stroke={tick === 0 ? AXIS : GRID}
            strokeWidth="1"
          />
          <text
            x={pad.left - 8}
            y={y(tick) + 4}
            textAnchor="end"
            fontSize="11"
            fill={INK.muted}
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {tick}
          </text>
        </g>
      ))}

      {chart.xLabels.map((label, index) => (
        <text
          key={label}
          x={x(index)}
          y={height - 14}
          textAnchor="middle"
          fontSize="11"
          fill={INK.muted}
        >
          {label}
        </text>
      ))}

      {chart.series.map((series, seriesIndex) => {
        const color = SERIES_COLORS[seriesIndex % SERIES_COLORS.length]
        const points = series.values.map((value, index) => `${x(index)},${y(value)}`)
        const lastIndex = series.values.length - 1

        return (
          <g key={series.name}>
            <polyline
              points={points.join(' ')}
              fill="none"
              stroke={color}
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {/* End marker carries a surface ring so converging lines stay
                legible where they cross. */}
            <circle
              cx={x(lastIndex)}
              cy={y(series.values[lastIndex])}
              r="4"
              fill={color}
              stroke={SURFACE}
              strokeWidth="2"
            />
            <text
              x={x(lastIndex) + 10}
              y={endLabelY[seriesIndex] + 4}
              fontSize="11"
              fill={INK.secondary}
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {series.values[lastIndex]}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

function BarChart({ chart }) {
  const width = 640
  const height = 320
  const pad = { top: 16, right: 16, bottom: 44, left: 48 }

  const ticks = niceTicks(Math.max(...allValues(chart)))
  const maxTick = ticks[ticks.length - 1]

  const plotWidth = width - pad.left - pad.right
  const plotHeight = height - pad.top - pad.bottom

  const bandWidth = plotWidth / chart.xLabels.length
  const gap = 2 // surface gap between touching bars
  const barWidth = Math.min(
    24,
    (bandWidth * 0.62 - gap * (chart.series.length - 1)) / chart.series.length,
  )
  const groupWidth = barWidth * chart.series.length + gap * (chart.series.length - 1)

  const y = (value) => pad.top + plotHeight - (value / maxTick) * plotHeight

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img">
      {ticks.map((tick) => (
        <g key={tick}>
          <line
            x1={pad.left}
            x2={pad.left + plotWidth}
            y1={y(tick)}
            y2={y(tick)}
            stroke={tick === 0 ? AXIS : GRID}
            strokeWidth="1"
          />
          <text
            x={pad.left - 8}
            y={y(tick) + 4}
            textAnchor="end"
            fontSize="11"
            fill={INK.muted}
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {tick}
          </text>
        </g>
      ))}

      {chart.xLabels.map((label, bandIndex) => {
        const bandCentre = pad.left + bandWidth * (bandIndex + 0.5)
        const groupLeft = bandCentre - groupWidth / 2

        return (
          <g key={label}>
            {chart.series.map((series, seriesIndex) => {
              const value = series.values[bandIndex]
              const barLeft = groupLeft + seriesIndex * (barWidth + gap)
              const barTop = y(value)
              const barHeight = y(0) - barTop
              const radius = Math.min(4, barHeight)

              // Rounded at the data end, square at the baseline.
              const path = [
                `M ${barLeft} ${y(0)}`,
                `L ${barLeft} ${barTop + radius}`,
                `Q ${barLeft} ${barTop} ${barLeft + radius} ${barTop}`,
                `L ${barLeft + barWidth - radius} ${barTop}`,
                `Q ${barLeft + barWidth} ${barTop} ${barLeft + barWidth} ${barTop + radius}`,
                `L ${barLeft + barWidth} ${y(0)}`,
                'Z',
              ].join(' ')

              return (
                <path
                  key={series.name}
                  d={path}
                  fill={SERIES_COLORS[seriesIndex % SERIES_COLORS.length]}
                />
              )
            })}

            <text
              x={bandCentre}
              y={height - 18}
              textAnchor="middle"
              fontSize="11"
              fill={INK.muted}
            >
              {label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

const polarToCartesian = (cx, cy, radius, angle) => ({
  x: cx + radius * Math.cos(angle - Math.PI / 2),
  y: cy + radius * Math.sin(angle - Math.PI / 2),
})

function Pie({ values, labels, cx, cy, radius }) {
  const total = values.reduce((sum, value) => sum + value, 0)
  // Separation is a gap in the surface, not a stroke drawn around each slice.
  const gapAngle = 2 / radius

  let angle = 0
  return values.map((value, index) => {
    const sweep = (value / total) * Math.PI * 2
    const start = angle + gapAngle / 2
    const end = angle + sweep - gapAngle / 2
    angle += sweep

    const from = polarToCartesian(cx, cy, radius, start)
    const to = polarToCartesian(cx, cy, radius, end)
    const large = end - start > Math.PI ? 1 : 0
    const mid = polarToCartesian(cx, cy, radius + 18, (start + end) / 2)

    return (
      <g key={labels[index]}>
        <path
          d={`M ${cx} ${cy} L ${from.x} ${from.y} A ${radius} ${radius} 0 ${large} 1 ${to.x} ${to.y} Z`}
          fill={SERIES_COLORS[index % SERIES_COLORS.length]}
        />
        {/* Values sit outside the slice: a thin segment cannot hold text
            without clipping it, and every slice needs its number here. */}
        <text
          x={mid.x}
          y={mid.y + 4}
          textAnchor="middle"
          fontSize="11"
          fill={INK.secondary}
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {value}%
        </text>
      </g>
    )
  })
}

function PieChart({ chart }) {
  const width = 640
  const height = 300
  const radius = 78

  return (
    <>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img">
        {chart.series.map((series, index) => {
          const cx = width * (index === 0 ? 0.27 : 0.73)
          const cy = height / 2 - 6
          return (
            <g key={series.name}>
              <Pie
                values={series.values}
                labels={chart.xLabels}
                cx={cx}
                cy={cy}
                radius={radius}
              />
              <text
                x={cx}
                y={height - 14}
                textAnchor="middle"
                fontSize="12"
                fontWeight="500"
                fill={INK.primary}
              >
                {series.name}
              </text>
            </g>
          )
        })}
      </svg>
      {/* The legend names the segments, which the two pies share. */}
      <Legend series={chart.xLabels.map((name) => ({ name }))} />
    </>
  )
}

function TableChart({ chart }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200">
            <th className="py-2 pr-3 text-left font-medium text-slate-500" />
            {chart.xLabels.map((label) => (
              <th
                key={label}
                className="py-2 pl-3 text-right font-medium text-slate-500 tabular-nums"
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {chart.series.map((series) => (
            <tr key={series.name} className="border-b border-slate-100 last:border-0">
              <td className="py-2 pr-3 text-slate-700">{series.name}</td>
              {series.values.map((value, index) => (
                <td
                  key={chart.xLabels[index]}
                  className="py-2 pl-3 text-right text-slate-700 tabular-nums"
                >
                  {value}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const RENDERERS = {
  line: LineChart,
  bar: BarChart,
  pie: PieChart,
  table: TableChart,
}

export default function Chart({ chart }) {
  const Renderer = RENDERERS[chart?.kind]
  if (!Renderer) return null

  return (
    <figure className="rounded-2xl border border-slate-200 bg-white p-5">
      <figcaption className="mb-3 text-sm font-medium text-slate-700">
        {chart.caption}
        <span className="ml-2 font-normal text-slate-400">({chart.unit})</span>
      </figcaption>

      <Renderer chart={chart} />

      {/* Pies bring their own legend keyed to segments, not series. */}
      {chart.kind !== 'pie' && chart.kind !== 'table' && (
        <Legend series={chart.series} />
      )}
    </figure>
  )
}
