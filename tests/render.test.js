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
    assert.ok(html.includes('Айтылым бағаланбайды'), 'pronunciation caveat in speaking')
    assert.ok(!html.includes('criteria.'), 'no untranslated keys')
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
    assert.ok(!html.includes('Айтылым бағаланбайды'))
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
