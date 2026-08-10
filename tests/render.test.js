import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

import { createServer } from 'vite'
import { createElement as h } from 'react'
import { renderToString } from 'react-dom/server'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// Server-rendering the real components catches what a unit test cannot: a
// missing translation key, a crash on an empty list, NaN coordinates in the
// chart. There is no browser here, so anything touching window/localStorage
// must already be inside an effect — which is itself worth enforcing.
let server
let render
let components = {}

before(async () => {
  server = await createServer({
    root: projectRoot,
    server: { middlewareMode: true },
    appType: 'custom',
    logLevel: 'error',
  })

  const { LanguageProvider } = await server.ssrLoadModule('/src/i18n.jsx')

  render = (element) =>
    // SSR splits adjacent text nodes with `<!-- -->`; strip it so assertions
    // match the strings a reader actually sees.
    renderToString(h(LanguageProvider, null, element)).replaceAll('<!-- -->', '')

  for (const name of [
    'App',
    'components/AnalysisResult',
    'components/HistoryPanel',
    'components/Header',
    'components/Interview',
    'components/MistakePatterns',
    'components/ProgressChart',
  ]) {
    const module = await server.ssrLoadModule(`/src/${name}.jsx`)
    components[name.split('/').pop()] = module.default
  }
})

after(async () => {
  await server?.close()
})

const bi = (kk, en) => ({ kk, en })
const criterion = (band, text = 'x') => ({ band, comment: bi(text, text) })

const result = {
  overall_band: 6.5,
  level: 'B2',
  summary: bi('Қорытынды.', 'Summary.'),
  criteria: {
    task_response: criterion(6),
    fluency_coherence: criterion(7),
    lexical_resource: criterion(6.5),
    grammatical_range: criterion(6),
  },
  strengths: [bi('Күшті жағы.', 'A strength.')],
  improvements: [bi('Жақсарту.', 'An improvement.')],
  corrections: [
    {
      original: 'I go',
      corrected: 'I went',
      category: 'tense',
      explanation: bi('Өткен шақ.', 'Past tense.'),
    },
  ],
  next_step: bi('Келесі қадам.', 'Next step.'),
}

const text = 'Yesterday I go to the shop.'

const entries = [
  { id: 'c', at: 3000, mode: 'write', band: 7, previousBand: 6.5, result },
  { id: 'b', at: 2000, mode: 'speak', band: 6.5, previousBand: 6, result },
  { id: 'a', at: 1000, mode: 'speak', band: 6, previousBand: null, result },
]

describe('App', () => {
  it('renders without a browser', () => {
    const html = render(h(components.App))
    assert.ok(html.includes('AIELTS'))
    assert.ok(html.includes('Сөйлеу'), 'Kazakh is the default UI language')
    assert.ok(!html.includes('undefined'), 'no undefined leaked into the markup')
  })
})

describe('AnalysisResult', () => {
  it('shows the band, level, inline marks and the delta', () => {
    const html = render(
      h(components.AnalysisResult, { result, text, mode: 'speaking', previousBand: 6 }),
    )
    assert.ok(html.includes('6.5'))
    assert.ok(html.includes('CEFR B2'))
    assert.ok(html.includes('<mark'), 'corrections are highlighted inline')
    assert.ok(html.includes('+0.5'), 'improvement over the last attempt')
    assert.ok(
      html.includes('Айтылым бағаланбады'),
      'a speaking result with no pronunciation criterion says why',
    )
    assert.ok(!html.includes('criteria.'), 'no untranslated keys')
  })

  it('renders the pronunciation criterion and drops the caveat when audio was marked', () => {
    const html = render(
      h(components.AnalysisResult, {
        result: {
          ...result,
          criteria: { ...result.criteria, pronunciation: criterion(6) },
          mispronounced: [
            { word: 'comfortable', heard: 'com-for-table', note: { kk: 'Екпін', en: 'Stress' } },
          ],
        },
        text,
        mode: 'speaking',
        previousBand: null,
      }),
    )
    assert.ok(html.includes('Айтылым'), 'the criterion is labelled')
    assert.ok(!html.includes('Айтылым бағаланбады'), 'no caveat once it is assessed')
    assert.ok(html.includes('com-for-table'), 'mispronounced words are listed')
  })

  it('explains a failed pronunciation pass rather than silently omitting it', () => {
    const html = render(
      h(components.AnalysisResult, {
        result,
        text,
        mode: 'speaking',
        previousBand: null,
        notes: ['pronunciationFailed'],
      }),
    )
    assert.ok(html.includes('сәтсіз аяқталды'), 'the reason reaches the user')
  })

  it('says when only part of a long recording was heard', () => {
    // A trim changes what was assessed, so it is worth saying even when the
    // pronunciation criterion came back perfectly fine.
    const html = render(
      h(components.AnalysisResult, {
        result: { ...result, criteria: { ...result.criteria, pronunciation: criterion(6) } },
        text,
        mode: 'speaking',
        previousBand: null,
        notes: ['audioTrimmed'],
      }),
    )
    assert.ok(html.includes('алғашқы бөлігі ғана тыңдалды'))
    assert.ok(!html.includes('Айтылым бағаланбады'), 'the criterion was still marked')
  })

  it('uses the writing criterion set and drops the speaking caveat', () => {
    const html = render(
      h(components.AnalysisResult, {
        result: {
          ...result,
          criteria: {
            task_achievement: criterion(6),
            coherence_cohesion: criterion(7),
            lexical_resource: criterion(6.5),
            grammatical_range: criterion(6),
          },
        },
        text,
        mode: 'writing',
        previousBand: null,
      }),
    )
    assert.ok(html.includes('Тапсырманы орындау'))
    assert.ok(html.includes('Байланыстылық пен құрылым'))
    assert.ok(!html.includes('Айтылым бағаланбады'))
    assert.ok(html.includes('Бірінші талпыныс'))
  })

  it('badges a sample so it cannot be mistaken for the user’s own', () => {
    const html = render(
      h(components.AnalysisResult, {
        result,
        text,
        mode: 'speaking',
        previousBand: null,
        isSample: true,
      }),
    )
    assert.ok(html.includes('Үлгі'))
  })
})

describe('ProgressChart', () => {
  it('draws a line per mode with no NaN coordinates', () => {
    const html = render(h(components.ProgressChart, { entries }))
    assert.ok(html.includes('<svg'))
    assert.ok(html.includes('polyline'))
    assert.ok(html.includes('#2a78d6') && html.includes('#eb6834'))
    assert.ok(!/NaN/.test(html))
    assert.ok(html.includes('7.0') && html.includes('6.5'), 'latest point labelled')
  })

  it('asks for a second attempt before drawing a trend', () => {
    const html = render(h(components.ProgressChart, { entries: [entries[2]] }))
    assert.ok(html.includes('Кемінде екі талпыныс'))
  })
})

describe('MistakePatterns', () => {
  it('surfaces a repeated category once there is history', () => {
    const html = render(h(components.MistakePatterns, { entries }))
    assert.ok(html.includes('Қайталанатын қателер'))
    assert.ok(html.includes('Шақ'), 'the repeated category is named')
  })

  it('stays hidden with a single attempt', () => {
    const html = render(h(components.MistakePatterns, { entries: [entries[0]] }))
    assert.equal(html, '')
  })
})

describe('HistoryPanel', () => {
  const props = {
    entries,
    isLoading: false,
    error: null,
    onOpen() {},
    onDelete() {},
    onClear() {},
    onSignIn() {},
  }

  it('nudges a guest to sign in', () => {
    const html = render(h(components.HistoryPanel, { ...props, isSignedIn: false, isAuthEnabled: true }))
    assert.ok(html.includes('Қонақ'))
    assert.ok(html.includes('Google арқылы кіру'))
    assert.ok(html.includes('+0.5'), 'per-attempt delta')
  })

  it('shows the synced state when signed in', () => {
    const html = render(h(components.HistoryPanel, { ...props, isSignedIn: true, isAuthEnabled: true }))
    assert.ok(html.includes('аккаунтыңызда'))
    assert.ok(!html.includes('Қонақ'))
  })

  it('hides auth entirely when Supabase is not configured', () => {
    const html = render(h(components.HistoryPanel, { ...props, isSignedIn: false, isAuthEnabled: false }))
    assert.ok(!html.includes('Google арқылы кіру'))
    assert.ok(html.includes('+0.5'), 'history still works')
  })
})

describe('Header', () => {
  it('hides the auth controls when auth is off', () => {
    const html = render(h(components.Header, { auth: { isEnabled: false, isReady: true, user: null } }))
    assert.ok(!html.includes('Google арқылы кіру'))
  })

  it('offers sign-in when signed out', () => {
    const html = render(
      h(components.Header, {
        auth: { isEnabled: true, isReady: true, user: null, signIn() {}, signOut() {} },
      }),
    )
    assert.ok(html.includes('Google арқылы кіру'))
  })

  it('shows the account when signed in', () => {
    const html = render(
      h(components.Header, {
        auth: {
          isEnabled: true,
          isReady: true,
          user: {
            email: 'test@example.com',
            user_metadata: { full_name: 'Test User', avatar_url: 'https://x/y.png' },
          },
          signIn() {},
          signOut() {},
        },
      }),
    )
    assert.ok(html.includes('Test User'))
    assert.ok(html.includes('https://x/y.png'))
    assert.ok(!html.includes('Google арқылы кіру'))
  })
})

describe('Interview', () => {
  const base = {
    turns: [],
    error: null,
    isSupported: true,
    isListening: false,
    elapsedMs: 0,
    transcript: '',
    interim: '',
    onStart() {},
    onToggleRecord() {},
    onTranscriptChange() {},
    onSubmit() {},
    onRetry() {},
    onFinishEarly() {},
  }

  it('offers each part as its own practice unit before starting', () => {
    const html = render(
      h(components.Interview, { ...base, status: 'idle', current: null }),
    )
    assert.ok(html.includes('Толық емтихан'))
    assert.ok(html.includes('2-бөлім — карточка бойынша монолог'))
    assert.ok(html.includes('11 кезек'), 'the full test states its length')
    assert.ok(html.includes('2 кезек'), 'and so does a single part')
    assert.ok(!html.includes('interview.'), 'no untranslated keys')
  })

  it('renders a cue card with its bullets, not as a plain question', () => {
    const html = render(
      h(components.Interview, {
        ...base,
        status: 'answering',
        current: {
          part: 2,
          kind: 'cue_card',
          index: 4,
          prepSeconds: 60,
          maxSeconds: 120,
          question: 'Describe a park you like to visit.',
          bullets: ['where it is', 'how often you go', 'what you do', 'explain why'],
        },
      }),
    )
    assert.ok(html.includes('Describe a park you like to visit.'))
    assert.ok(html.includes('Мыналарды айтуыңыз керек'))
    assert.ok(html.includes('explain why'))
    assert.ok(html.includes('2-бөлім'), 'the part is labelled')
    assert.ok(html.includes('Дайындалу уақыты'), 'Part 2 gets its preparation minute')
  })

  it('gives an ordinary question no preparation time', () => {
    const html = render(
      h(components.Interview, {
        ...base,
        status: 'answering',
        current: {
          part: 1, kind: 'question', index: 0, prepSeconds: 0, maxSeconds: 60,
          question: 'Where do you live?',
        },
      }),
    )
    assert.ok(html.includes('Where do you live?'))
    assert.ok(!html.includes('Дайындалу уақыты'))
  })

  it('lists the turns already taken, marking any left unanswered', () => {
    const html = render(
      h(components.Interview, {
        ...base,
        status: 'answering',
        current: {
          part: 1, kind: 'question', index: 1, prepSeconds: 0, maxSeconds: 60,
          question: 'Do you like it?',
        },
        turns: [
          { part: 1, kind: 'question', question: 'Where do you live?', answer: 'in astana' },
          { part: 1, kind: 'question', question: 'And before that?', answer: '   ' },
        ],
      }),
    )
    assert.ok(html.includes('in astana'))
    assert.ok(html.includes('(жауап жазылмады)'))
  })

  it('surfaces a failed question with a way to retry', () => {
    const html = render(
      h(components.Interview, {
        ...base,
        status: 'answering',
        current: null,
        error: 'Сағаттық шек асты.',
      }),
    )
    assert.ok(html.includes('Сағаттық шек асты.'))
    assert.ok(html.includes('Қайталап көру'))
  })
})

describe('Interview progress', () => {
  const base = {
    turns: [], error: null, isSupported: true, isListening: false, elapsedMs: 0,
    transcript: '', interim: '',
    onStart() {}, onToggleRecord() {}, onTranscriptChange() {},
    onSubmit() {}, onRetry() {}, onFinishEarly() {},
  }

  it('announces Part 1 while the opening question is still being written', () => {
    // `current` is null during the request; reading the part off the previous
    // turn instead reported Part 3 before Part 1 had been asked.
    const html = render(
      h(components.Interview, { ...base, status: 'asking', current: null }),
    )
    assert.ok(html.includes('1-бөлім'))
    assert.ok(html.includes('1 / 11'))
    assert.ok(!html.includes('3-бөлім'))
    assert.ok(!html.includes('0 / 11'))
  })

  it('counts the turn on screen, not the ones already filed', () => {
    const html = render(
      h(components.Interview, {
        ...base,
        status: 'answering',
        turns: [{ part: 1, kind: 'question', question: 'q', answer: 'a' }],
        current: {
          part: 1, kind: 'question', index: 1, prepSeconds: 0, maxSeconds: 60,
          question: 'Do you like it?',
        },
      }),
    )
    assert.ok(html.includes('2 / 11'))
  })
})
