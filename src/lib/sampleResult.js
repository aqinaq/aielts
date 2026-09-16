// A pre-computed analysis so a first-time visitor can see what the tool
// actually produces without an API key, an account, or spending a request.
// The transcript is written the way the recognizer really returns speech:
// lowercase, unpunctuated, with the mistakes a B2 candidate typically makes.

export const SAMPLE_TASK =
  'Describe a place in your hometown that you like to visit. You should say: where it is, how often you go there, what you do there, and explain why you like it. You have 1 minute to prepare and should speak for 1–2 minutes.'

export const SAMPLE_TEXT =
  'i want to talk about a place in my hometown that i like to visit it is a park near the river in the centre of astana i go there maybe two or three times in a week usually in the evening after i finish my study when i was child my family go there every weekend so this place have many memories for me the park is very big and there is a long path where people can walking or riding bicycle in summer there is also small cafe where i drink coffee with my friends i like this place because it is quiet and i can relax after busy day also the air is more fresh than other parts of city and when i have a difficult problem i go there and think about it and usually i find solution'

export const SAMPLE_METRICS = {
  wordCount: 148,
  durationMs: 77000,
  wordsPerMinute: 115,
  fillerCount: 3,
  fillerBreakdown: [{ phrase: 'you know', count: 2 }, { phrase: 'um', count: 1 }],
  repeatCount: 1,
  longPauses: 2,
  longestPauseMs: 4100,
  speechRatio: 0.82,
  measuredPauses: true,
  verbatim: true,
}

export const SAMPLE_RESULT = {
  overall_band: 6,
  level: 'B2',
  summary: {
    kk: 'Жауап тапсырманың төрт бөлігін де қамтиды және аяғына дейін түсінікті. Идеялар байланысты, бірақ грамматикалық қателер жиі — әсіресе өткен шақ пен етістіктің жіктелуінде. Лексика жеткілікті, дегенмен қарапайым сөздер қайталанады.',
    en: 'The answer covers all four parts of the prompt and stays clear throughout. Ideas connect logically, but grammatical slips are frequent — especially past tense and subject-verb agreement. Vocabulary is adequate, though it leans on simple, repeated words.',
  },
  task_feedback: {
    kk: 'Тапсырманың төрт тармағы да қамтылған: орны («a park near the river»), жиілігі, не істейтіні және себебі. Соңғы бөлім («when i have a difficult problem i go there») жеке мысалмен нақтыланған — бұл жақсы.',
    en: 'All four bullet points are addressed: the location ("a park near the river"), the frequency, the activities, and the reason. The final part ("when i have a difficult problem i go there") is developed with a personal example.',
  },
  criteria: {
    fluency_coherence: {
      band: 6.5,
      comment: {
        kk: 'Қарқын 115 сөз/мин — қалыпты диапазонға жақын, ұзақ кідіріс екеу ғана. Байланыстырғыштар қарапайым («and», «so», «also»); «however», «that is why» сияқтылар қосылса, баға көтерілер еді.',
        en: 'At 115 words per minute the pace is close to the comfortable range, with only two long pauses. Linking is basic ("and", "so", "also"); reaching for "however" or "that is why" would raise this.',
      },
    },
    lexical_resource: {
      band: 6,
      comment: {
        kk: '«Quiet», «relax», «memories» орынды қолданылған, бірақ сөздік қоры қарапайым деңгейде қалып отыр. «Very big» орнына «spacious», «fresh air» орнына «crisp air» сияқты нақтырақ тіркестер керек.',
        en: '"Quiet", "relax" and "memories" are used appropriately, but the range stays basic. More precise choices — "spacious" instead of "very big", "crisp air" instead of "fresh air" — would show a wider resource.',
      },
    },
    grammatical_range: {
      band: 5.5,
      comment: {
        kk: 'Қателер жиілігі жоғары: артикль түсіп қалуы («when i was child», «small cafe»), етістіктің жіктелмеуі («this place have»), өткен шақтың сақталмауы («my family go there»). Құрылымдар негізінен қарапайым сөйлемдер.',
        en: 'Errors are frequent: dropped articles ("when i was child", "small cafe"), agreement failures ("this place have"), and a past-tense narrative told in the present ("my family go there"). Structures are mostly simple sentences.',
      },
    },
    pronunciation: {
      band: 6.5,
      comment: {
        kk: 'Сөйлеу түсінікті, тыңдаушыны шаршатпайды. Жеке дыбыстар негізінен дұрыс, бірақ сөз екпіні кейде ауысады және сөйлем соңы бірқалыпты — интонация арқылы мағына екпінін беру жетіспейді.',
        en: 'You are comfortable to follow and the listener never has to work. Individual sounds are mostly accurate, but word stress slips on longer words and sentence endings stay flat, so intonation is not yet doing any work for you.',
      },
    },
  },
  mispronounced: [
    {
      word: 'comfortable',
      heard: 'com-for-TAY-bul',
      note: {
        kk: 'Екпін бірінші буында: КАМФ-тыр-бл — үш буын, ортасы жұтылады.',
        en: 'Stress the first syllable and swallow the middle one: KUMF-ta-bl, three syllables not four.',
      },
    },
    {
      word: 'bicycle',
      heard: 'bi-SIGH-kul',
      note: {
        kk: 'Екпін басында: БАЙ-си-кл. Ортаңғы буын қысқа.',
        en: 'Stress falls on the first syllable: BY-si-kl, with a short middle vowel.',
      },
    },
  ],
  strengths: [
    {
      kk: 'Тапсырманың барлық тармағын қамтып, әрқайсысын мысалмен нақтылағансыз.',
      en: 'You covered every bullet point and backed each one with a concrete detail.',
    },
    {
      kk: 'Жауап басынан аяғына дейін бір тақырыпта — ауытқу жоқ.',
      en: 'The answer stays on topic from start to finish, with no drift.',
    },
    {
      kk: 'Қарқын тұрақты, ұзақ кідіріс аз — тыңдауға жеңіл.',
      en: 'The pace is steady with few long pauses, which makes you easy to follow.',
    },
  ],
  improvements: [
    {
      kk: 'Өткен шақты бекітіңіз. Балалық шақ туралы айтқанда «my family go» емес, «my family went» болуы керек — бұл ең жиі кездескен қате.',
      en: 'Fix past tense. When you talk about childhood it must be "my family went", not "my family go" — this was the most frequent error.',
    },
    {
      kk: 'Артикльдерге назар аударыңыз: «a child», «a small cafe», «a busy day». Бір ғана осы түзету грамматика баллын жарты балға көтерер еді.',
      en: 'Watch your articles: "a child", "a small cafe", "a busy day". This one fix alone would likely add half a band to grammar.',
    },
    {
      kk: 'Байланыстырғыштарды әртараптандырыңыз. «And» орнына «because of that», «what is more» қолданып көріңіз.',
      en: 'Vary your linking words. Try "because of that" or "what is more" in place of another "and".',
    },
  ],
  corrections: [
    {
      original: 'two or three times in a week',
      category: 'preposition',
      corrected: 'two or three times a week',
      explanation: {
        kk: 'Жиілікті білдіргенде «in» көмекші сөзі қажет емес: «times a week».',
        en: 'Frequency takes no preposition here: "times a week".',
      },
    },
    {
      original: 'when i was child',
      category: 'article',
      corrected: 'when i was a child',
      explanation: {
        kk: 'Санауға келетін зат есімнің алдында артикль керек: «a child».',
        en: 'A singular countable noun needs an article: "a child".',
      },
    },
    {
      original: 'my family go there every weekend',
      category: 'tense',
      corrected: 'my family went there every weekend',
      explanation: {
        kk: 'Балалық шақ туралы әңгіме — өткен шақ керек: «went».',
        en: 'This is a childhood memory, so it needs the past tense: "went".',
      },
    },
    {
      original: 'this place have many memories',
      category: 'agreement',
      corrected: 'this place has many memories',
      explanation: {
        kk: '«This place» — үшінші жақ жекеше, сондықтан «has».',
        en: '"This place" is third-person singular, so the verb is "has".',
      },
    },
    {
      original: 'people can walking',
      category: 'word_form',
      corrected: 'people can walk',
      explanation: {
        kk: 'Модаль етістіктен кейін негізгі етістік бастапқы формада тұрады.',
        en: 'A modal verb is followed by the bare infinitive, not the -ing form.',
      },
    },
    {
      original: 'there is also small cafe',
      category: 'article',
      corrected: 'there is also a small cafe',
      explanation: {
        kk: 'Тағы бір түсіп қалған артикль: «a small cafe».',
        en: 'Another dropped article: "a small cafe".',
      },
    },
    {
      original: 'more fresh',
      category: 'word_form',
      corrected: 'fresher',
      explanation: {
        kk: 'Бір буынды сын есімдер «-er» жалғауымен салыстырылады.',
        en: 'One-syllable adjectives form the comparative with "-er".',
      },
    },
  ],
  next_step: {
    kk: 'Осы жауапты қайта жазыңыз, бірақ бәрін өткен шақта айтыңыз, әр зат есімнің алдында артикль бар-жоғын тексеріңіз. Содан кейін қайта жазып, екі баллды салыстырыңыз.',
    en: 'Record this answer again, but tell the whole thing in the past tense and check every noun for a missing article. Then re-analyze it and compare the two bands.',
  },
}
