// Data for Academic Writing Task 1.
//
// The charts are generated from data held here rather than uploaded as images,
// and that is the whole point: because the exact figures are known, the grader
// can be handed them and check whether the candidate reported them correctly.
// Task Achievement in Task 1 is largely "did you select the key features and
// report the data accurately" — a marker working from a picture can only guess
// at that, while one working from the numbers can say "you wrote 6.2 where the
// graph shows 1.3".
//
// Colours come from the validated categorical palette, in its fixed slot order.
// Five slots clear every colour-blindness gate on the *adjacent* pairlist, which
// is the one that applies here — lines, grouped bars and pie segments are only
// ever compared with their neighbours. A sixth category would have to fold into
// "Other" rather than take a generated hue.
//
// Three of the five sit below 3:1 contrast on white, so the validator requires
// "relief": every pie segment carries its value as text and every chart has a
// legend, which is what satisfies it. Do not remove those labels.

export const SERIES_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4']

export const CHARTS = {
  'museum-visitors': {
    kind: 'line',
    caption: 'Visitors to three London museums, 2015–2020',
    unit: 'million visitors',
    xLabels: ['2015', '2016', '2017', '2018', '2019', '2020'],
    series: [
      { name: 'British Museum', values: [6.8, 6.4, 6.0, 5.9, 6.2, 1.3] },
      { name: 'Tate Modern', values: [4.7, 5.8, 5.7, 5.9, 6.1, 1.4] },
      { name: 'Science Museum', values: [3.3, 3.2, 3.1, 3.3, 3.2, 0.9] },
    ],
  },

  'housework-hours': {
    kind: 'bar',
    caption: 'Average weekly hours of unpaid housework, by gender, 2019',
    unit: 'hours per week',
    xLabels: ['Japan', 'United Kingdom', 'Sweden', 'Turkey'],
    series: [
      { name: 'Women', values: [25, 17, 14, 31] },
      { name: 'Men', values: [5, 9, 12, 6] },
    ],
  },

  'household-spending': {
    kind: 'pie',
    caption: 'How an average household spent its income, 1990 and 2020',
    unit: '% of income',
    // Two pies compared side by side is the standard Academic Task 1 shape;
    // five segments stays inside the six a reader can hold at a glance.
    groups: ['1990', '2020'],
    xLabels: ['Housing', 'Food', 'Transport', 'Leisure', 'Other'],
    series: [
      { name: '1990', values: [25, 30, 12, 13, 20] },
      { name: '2020', values: [34, 18, 16, 20, 12] },
    ],
  },

  'internet-users': {
    kind: 'table',
    caption: 'Population using the internet, five countries',
    unit: '% of population',
    xLabels: ['2000', '2010', '2020'],
    series: [
      { name: 'Kazakhstan', values: [0.7, 31.6, 85.9] },
      { name: 'Brazil', values: [2.9, 40.7, 81.3] },
      { name: 'Germany', values: [30.2, 82.0, 89.8] },
      { name: 'India', values: [0.5, 7.5, 43.0] },
      { name: 'Japan', values: [30.0, 78.2, 90.2] },
    ],
  },
}

/**
 * The chart written out as text, for the grader.
 *
 * Sent alongside the prompt so the model can mark factual accuracy instead of
 * inferring the figures from prose. Kept compact and unambiguous: a header row
 * of categories, then one row per series.
 */
export function describeChart(chart) {
  if (!chart) return ''

  const header = ['', ...chart.xLabels].join(' | ')
  const rows = chart.series.map((series) =>
    [series.name, ...series.values].join(' | '),
  )

  return [
    `${chart.caption} (${chart.unit}).`,
    'The figures shown in the chart are:',
    header,
    ...rows,
  ].join('\n')
}

/** Every value across every series — what the y-axis has to span. */
export const allValues = (chart) => chart.series.flatMap((series) => series.values)

// --- geometry helpers ---------------------------------------------------
//
// Pure maths, kept out of the component so they can be tested without a
// browser or a JSX loader.

/** Axis ticks on round numbers, which is what a reader can actually use. */
export function niceTicks(max, count = 5) {
  if (!(max > 0)) return [0]

  const rough = max / count
  const magnitude = 10 ** Math.floor(Math.log10(rough))
  const step = [1, 2, 2.5, 5, 10].map((n) => n * magnitude).find((n) => n >= rough)

  const ticks = []
  // Runs until a tick has passed the data, so the top gridline is always at or
  // above the highest value. Stopping earlier lets a line or bar escape the
  // plot area, which is how a 6.8 ends up drawn above a 6.0 axis.
  for (let value = 0; ; value += step) {
    // Floating-point steps like 2.5 accumulate error; round to the step's own
    // precision so a tick reads "7.5" and never "7.500000000000001".
    ticks.push(Number(value.toFixed(6)))
    if (value >= max) break
  }
  return ticks
}

/**
 * Pushes overlapping labels apart along one axis.
 *
 * Line ends cluster when series converge — the museum chart collapses three
 * lines into a narrow band in 2020 — and stacked-up text is worse than none.
 */
export function spreadLabels(positions, minGap = 14) {
  const order = positions
    .map((y, index) => ({ y, index }))
    .sort((a, b) => a.y - b.y)

  for (let i = 1; i < order.length; i += 1) {
    const gap = order[i].y - order[i - 1].y
    if (gap < minGap) order[i].y = order[i - 1].y + minGap
  }

  const result = []
  order.forEach((entry) => {
    result[entry.index] = entry.y
  })
  return result
}
