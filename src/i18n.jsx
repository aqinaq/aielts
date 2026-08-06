import { createContext, useContext, useEffect, useMemo, useState } from 'react'

export const LANGUAGES = [
  { value: 'kk', label: 'ҚАЗ' },
  { value: 'en', label: 'ENG' },
]

const translations = {
  kk: {
    appName: 'AIELTS',
    tagline: 'Сөйлеу мен жазуды бағалайтын AI құралы',

    auth: {
      signIn: 'Google арқылы кіру',
      signOut: 'Шығу',
      guestBadge: 'Қонақ',
      guestNote:
        'Тарих тек осы браузерде сақталады. Кірсеңіз, кез келген құрылғыдан қолжетімді болады.',
      syncedNote: 'Тарих аккаунтыңызда сақталады.',
      syncing: 'Синхрондалуда…',
      syncError: 'Синхрондау қатесі',
    },

    mode: {
      speak: 'Сөйлеу',
      write: 'Жазу',
    },

    task: {
      label: 'Тапсырма және шарттары',
      optional: 'міндетті емес',
      placeholder:
        'Тапсырманы осында жазыңыз немесе дайын тапсырмалардан таңдаңыз. Мысалы: «...Discuss both views. Кемінде 250 сөз, 40 минут.»',
      hint: 'Тапсырманы жазсаңыз, AI мәтіннің шартқа сай келуін де бағалайды.',
      pick: 'Дайын тапсырмалар',
      pickTitle: 'Тапсырма таңдаңыз',
      minutes: 'мин',
      minWords: 'сөзден кем емес',
      use: 'Таңдау',
      close: 'Жабу',
    },

    timer: {
      label: 'Емтихан таймері',
      start: 'Бастау',
      pause: 'Кідірту',
      reset: 'Қайта',
      done: 'Уақыт бітті',
    },

    speech: {
      start: 'Бастау үшін микрофонды басыңыз',
      listening: 'Тыңдап тұрмын… сөйлей беріңіз',
      startLabel: 'Жазуды бастау',
      stopLabel: 'Жазуды тоқтату',
      notSupported:
        'Бұл браузер дауыс тануды қолдамайды. Chrome немесе Edge-ті пайдаланыңыз, не «Жазу» режиміне ауысыңыз.',
      languageNote: 'Дауыс тану ағылшын тілінде жұмыс істейді.',
    },

    audio: {
      label: 'Жазбаңызды тыңдаңыз',
      note: 'Жазба тек осы бетте сақталады — бетті жаңартсаңыз жоғалады, ешқайда жіберілмейді.',
    },

    sample: {
      button: 'Үлгі нәтижені көру',
      badge: 'Үлгі',
      note: 'Бұл — дайын үлгі, сіздің жауабыңыз емес. Өз мәтініңізді талдау үшін сол жақтан бастаңыз.',
    },

    transcript: {
      label: 'Танылған мәтін',
      empty: 'Сөйлей бастаңыз…',
      placeholder:
        'Мұнда танылған мәтін шығады. Жазу біткен соң қолмен де түзете аласыз.',
    },

    essay: {
      label: 'Мәтінді енгізіңіз',
      placeholder:
        'Эссе, презентация мәтіні немесе кез келген ағылшын тіліндегі жазбаңызды осында қойыңыз…',
    },

    actions: {
      clear: 'Тазалау',
      analyze: 'Талдау және бағалау',
      analyzing: 'Талдау жүріп жатыр…',
      retry: 'Қайталап көру',
      shortcutHint: 'немесе ⌘/Ctrl + Enter',
      print: 'PDF / Басып шығару',
    },

    counter: {
      words: 'сөз',
      minWords: 'талдау үшін кемінде {{n}} сөз керек',
    },

    metrics: {
      title: 'Сөйлеу көрсеткіштері',
      duration: 'Ұзақтығы',
      wpm: 'Қарқын',
      wpmUnit: 'сөз/мин',
      wpmTarget: 'қалыпты: 120–150',
      fillers: 'Артық сөздер',
      repeats: 'Қайталаулар',
      pauses: 'Ұзақ кідірістер',
      note: 'Көрсеткіштер шамамен. Chrome «um», «uh» сияқты дыбыстарды көбіне мәтінге қоспайды, ал кідірістер тану кідірісіне байланысты дәл емес.',
    },

    result: {
      loading: 'AI мәтіңізді талдап жатыр…',
      loadingHint: 'Әдетте 20–40 секунд алады',
      emptyState: 'Сөйлеңіз немесе мәтін енгізіңіз — нәтиже осы жерде шығады.',
      errorTitle: 'Талдау сәтсіз аяқталды',
      band: 'Band',
      overall: 'Жалпы балл',
      strengths: 'Жақсы тұстары',
      improvements: 'Не жақсартуға болады',
      corrections: 'Нақты түзетулер',
      annotated: 'Мәтін ішіндегі белгілер',
      nextStep: 'Келесі қадам',
      firstAttempt: 'Бірінші талпыныс',
      comparedTo: 'алдыңғы талпыныспен салыстырғанда',
      pronunciationNote:
        'Айтылым бағаланбайды — құрал тек мәтінді талдайды, дыбысты емес.',
    },

    criteria: {
      task_achievement: 'Тапсырманы орындау',
      task_response: 'Тапсырмаға жауап',
      coherence_cohesion: 'Байланыстылық пен құрылым',
      fluency_coherence: 'Еркін сөйлеу мен байланыстылық',
      lexical_resource: 'Лексикалық қор',
      grammatical_range: 'Грамматика мен дәлдік',
    },

    patterns: {
      title: 'Қайталанатын қателер',
      hint: 'Соңғы талпыныстарыңыздағы ең жиі кездескен қателер.',
      occurrences: '{{n}} рет',
      inAttempts: '{{n}} талпыныста',
      empty: 'Қайталанатын қате әлі байқалмады.',
    },

    mistakes: {
      article: 'Артикльдер (a / an / the)',
      tense: 'Шақ',
      agreement: 'Бастауыш пен баяндауыш үйлесімі',
      preposition: 'Көмекші сөздер',
      word_form: 'Сөз формасы',
      word_order: 'Сөз тәртібі',
      vocabulary: 'Сөз таңдау',
      plural: 'Көптік жалғау',
      spelling: 'Емле',
      punctuation: 'Тыныс белгілері',
      other: 'Басқа',
    },

    history: {
      title: 'Талпыныстар тарихы',
      empty: 'Әзірге тарих жоқ. Бірінші талдаудан кейін осында пайда болады.',
      clear: 'Тарихты тазалау',
      confirmClear: 'Барлық тарихты өшіру керек пе?',
      open: 'Ашу',
      delete: 'Өшіру',
      chartTitle: 'Балл динамикасы',
      chartHint: 'Кемінде екі талпыныс керек.',
    },

    errors: {
      notAllowed:
        'Микрофонға рұқсат берілмеді. Браузер параметрлерінен рұқсат беріп, қайта көріңіз.',
      serviceNotAllowed:
        'Браузер дауыс тану қызметіне рұқсат бермеді. Chrome-да ашып көріңіз.',
      audioCapture: 'Микрофон табылмады. Құрылғының қосулы екенін тексеріңіз.',
      network: 'Желі қатесі. Интернет байланысын тексеріңіз.',
      languageNotSupported: 'Бұл браузер ағылшын тілін тануды қолдамайды.',
      startFailed: 'Жазуды бастау мүмкін болмады. Бір секундтан кейін қайталаңыз.',
      unknown: 'Дауыс тану қатесі.',
      requestFailed: 'Талдау сәтсіз аяқталды.',
    },
  },

  en: {
    appName: 'AIELTS',
    tagline: 'AI feedback on your speaking and writing',

    auth: {
      signIn: 'Sign in with Google',
      signOut: 'Sign out',
      guestBadge: 'Guest',
      guestNote:
        'History is kept in this browser only. Sign in to reach it from any device.',
      syncedNote: 'History is saved to your account.',
      syncing: 'Syncing…',
      syncError: 'Sync failed',
    },

    mode: {
      speak: 'Speaking',
      write: 'Writing',
    },

    task: {
      label: 'Task and requirements',
      optional: 'optional',
      placeholder:
        'Type the task here, or pick one from the bank. For example: "...Discuss both views. At least 250 words, 40 minutes."',
      hint: 'Add the task and the AI will also grade how well your answer meets it.',
      pick: 'Task bank',
      pickTitle: 'Choose a task',
      minutes: 'min',
      minWords: 'words minimum',
      use: 'Use',
      close: 'Close',
    },

    timer: {
      label: 'Exam timer',
      start: 'Start',
      pause: 'Pause',
      reset: 'Reset',
      done: "Time's up",
    },

    speech: {
      start: 'Press the microphone to start',
      listening: 'Listening… keep talking',
      startLabel: 'Start recording',
      stopLabel: 'Stop recording',
      notSupported:
        'This browser does not support speech recognition. Use Chrome or Edge, or switch to Writing mode.',
      languageNote: 'Speech recognition runs in English.',
    },

    audio: {
      label: 'Listen back',
      note: 'The recording stays on this page only — it is never uploaded, and it is gone on reload.',
    },

    sample: {
      button: 'See a sample analysis',
      badge: 'Sample',
      note: 'This is a pre-made example, not your own answer. Start on the left to analyze your own.',
    },

    transcript: {
      label: 'Transcript',
      empty: 'Start speaking…',
      placeholder:
        'Your transcript appears here. You can edit it by hand once recording stops.',
    },

    essay: {
      label: 'Enter your text',
      placeholder:
        'Paste an essay, a presentation script, or any other piece of English writing…',
    },

    actions: {
      clear: 'Clear',
      analyze: 'Analyze and score',
      analyzing: 'Analyzing…',
      retry: 'Try again',
      shortcutHint: 'or ⌘/Ctrl + Enter',
      print: 'PDF / Print',
    },

    counter: {
      words: 'words',
      minWords: 'at least {{n}} words needed to analyze',
    },

    metrics: {
      title: 'Delivery metrics',
      duration: 'Duration',
      wpm: 'Pace',
      wpmUnit: 'wpm',
      wpmTarget: 'typical: 120–150',
      fillers: 'Filler words',
      repeats: 'Repetitions',
      pauses: 'Long pauses',
      note: 'These are estimates. Chrome usually strips "um" and "uh" before the text reaches us, and pause detection lags because phrases are finalized after you stop speaking.',
    },

    result: {
      loading: 'The AI is reading your text…',
      loadingHint: 'Usually takes 20–40 seconds',
      emptyState: 'Speak or type something — your feedback will appear here.',
      errorTitle: 'Analysis failed',
      band: 'Band',
      overall: 'Overall',
      strengths: 'What worked well',
      improvements: 'What to improve',
      corrections: 'Specific corrections',
      annotated: 'Marked up in your text',
      nextStep: 'Next step',
      firstAttempt: 'First attempt',
      comparedTo: 'compared with your previous attempt',
      pronunciationNote:
        'Pronunciation is not assessed — this tool reads the transcript, not the audio.',
    },

    criteria: {
      task_achievement: 'Task achievement',
      task_response: 'Task response',
      coherence_cohesion: 'Coherence and cohesion',
      fluency_coherence: 'Fluency and coherence',
      lexical_resource: 'Lexical resource',
      grammatical_range: 'Grammatical range and accuracy',
    },

    patterns: {
      title: 'Recurring mistakes',
      hint: 'The mistakes that come up most often across your recent attempts.',
      occurrences: '{{n}} times',
      inAttempts: 'in {{n}} attempts',
      empty: 'No repeated pattern yet.',
    },

    mistakes: {
      article: 'Articles (a / an / the)',
      tense: 'Verb tense',
      agreement: 'Subject-verb agreement',
      preposition: 'Prepositions',
      word_form: 'Word form',
      word_order: 'Word order',
      vocabulary: 'Word choice',
      plural: 'Plurals',
      spelling: 'Spelling',
      punctuation: 'Punctuation',
      other: 'Other',
    },

    history: {
      title: 'Attempt history',
      empty: 'Nothing yet. Your attempts will show up here after the first analysis.',
      clear: 'Clear history',
      confirmClear: 'Delete the entire history?',
      open: 'Open',
      delete: 'Delete',
      chartTitle: 'Band over time',
      chartHint: 'Needs at least two attempts.',
    },

    errors: {
      notAllowed:
        'Microphone access was denied. Allow it in your browser settings and try again.',
      serviceNotAllowed:
        'The browser blocked the speech recognition service. Try opening this in Chrome.',
      audioCapture: 'No microphone found. Check that your device is connected.',
      network: 'Network error. Check your internet connection.',
      languageNotSupported: 'This browser cannot recognize English speech.',
      startFailed: 'Could not start recording. Try again in a second.',
      unknown: 'Speech recognition error.',
      requestFailed: 'Analysis failed.',
    },
  },
}

const LanguageContext = createContext(null)

const resolve = (dictionary, key) =>
  key.split('.').reduce((node, part) => node?.[part], dictionary)

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState('kk')

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const value = useMemo(() => {
    const t = (key, vars) => {
      const raw = resolve(translations[lang], key) ?? resolve(translations.kk, key) ?? key
      if (!vars) return raw
      return Object.entries(vars).reduce(
        (text, [name, replacement]) => text.replaceAll(`{{${name}}}`, replacement),
        raw,
      )
    }
    return { lang, setLang, t }
  }, [lang])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) throw new Error('useLanguage must be used inside <LanguageProvider>')
  return context
}
