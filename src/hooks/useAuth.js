import { useCallback, useEffect, useState } from 'react'

import { isSupabaseConfigured, supabase } from '../lib/supabase'

/**
 * Google sign-in via Supabase. Signing in is optional — when Supabase isn't
 * configured, or nobody is signed in, the app runs as a guest.
 */
export function useAuth() {
  const [session, setSession] = useState(null)
  // Nothing to wait for when auth is switched off entirely.
  const [isReady, setIsReady] = useState(!isSupabaseConfigured)

  useEffect(() => {
    if (!supabase) return undefined

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setIsReady(true)
    })

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setIsReady(true)
    })

    return () => data.subscription.unsubscribe()
  }, [])

  const signIn = useCallback(async () => {
    if (!supabase) return
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      // Come back to the page the user was on, not a hard-coded route.
      options: { redirectTo: window.location.origin },
    })
  }, [])

  const signOut = useCallback(async () => {
    if (!supabase) return
    await supabase.auth.signOut()
  }, [])

  return {
    isEnabled: isSupabaseConfigured,
    isReady,
    session,
    user: session?.user ?? null,
    signIn,
    signOut,
  }
}
