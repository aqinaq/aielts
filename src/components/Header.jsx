import { AudioLines, LogIn, LogOut } from 'lucide-react'

import { LANGUAGES, useLanguage } from '../i18n'

function AuthControls({ user, onSignIn, onSignOut }) {
  const { t } = useLanguage()

  if (!user) {
    return (
      <button
        type="button"
        onClick={onSignIn}
        className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-indigo-300 hover:text-indigo-700"
      >
        <LogIn className="size-3.5" aria-hidden="true" />
        {t('auth.signIn')}
      </button>
    )
  }

  const avatarUrl = user.user_metadata?.avatar_url
  const label = user.user_metadata?.full_name || user.email

  return (
    <div className="flex items-center gap-2">
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt=""
          className="size-7 rounded-full border border-slate-200"
        />
      ) : (
        <span className="flex size-7 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600">
          {label?.[0]?.toUpperCase()}
        </span>
      )}

      <span className="hidden max-w-40 truncate text-xs text-slate-500 sm:block">
        {label}
      </span>

      <button
        type="button"
        onClick={onSignOut}
        aria-label={t('auth.signOut')}
        title={t('auth.signOut')}
        className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
      >
        <LogOut className="size-4" aria-hidden="true" />
      </button>
    </div>
  )
}

export default function Header({ auth }) {
  const { lang, setLang, t } = useLanguage()

  return (
    <header className="border-b border-slate-200 bg-white/80 backdrop-blur print:hidden">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-6 py-5">
        <span className="flex size-10 items-center justify-center rounded-xl bg-indigo-600 text-white">
          <AudioLines className="size-5" aria-hidden="true" />
        </span>
        <div className="flex-1">
          <h1 className="text-lg font-semibold tracking-tight text-slate-900">
            {t('appName')}
          </h1>
          <p className="text-sm text-slate-500">{t('tagline')}</p>
        </div>

        {/* Hidden entirely when Supabase isn't configured — the app is still
            fully usable, it just keeps history on this device. */}
        {auth.isEnabled && auth.isReady && (
          <AuthControls
            user={auth.user}
            onSignIn={auth.signIn}
            onSignOut={auth.signOut}
          />
        )}

        <div className="flex rounded-lg bg-slate-100 p-0.5">
          {LANGUAGES.map((language) => (
            <button
              key={language.value}
              type="button"
              onClick={() => setLang(language.value)}
              aria-pressed={lang === language.value}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold tracking-wide transition ${
                lang === language.value
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {language.label}
            </button>
          ))}
        </div>
      </div>
    </header>
  )
}
