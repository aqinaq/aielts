import { useCallback, useEffect, useState } from 'react'

import {
  addLocal,
  addRemote,
  clearLocal,
  clearRemote,
  fetchRemote,
  loadLocal,
  makeEntry,
  migrateLocalToRemote,
  previousBandFor,
  removeLocal,
  removeRemote,
} from '../lib/history'

/**
 * Attempt history that follows the session: localStorage while signed out,
 * Supabase once signed in, with a one-time upload of the guest attempts.
 *
 * Every mutation updates state first so the UI stays responsive; if the remote
 * write fails the error is surfaced and the list is reloaded from the source of
 * truth rather than left in a half-applied state.
 */
export function useHistory(user) {
  const [entries, setEntries] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  const userId = user?.id ?? null

  useEffect(() => {
    if (!userId) {
      setEntries(loadLocal())
      return undefined
    }

    let cancelled = false
    setIsLoading(true)
    setError(null)
    ;(async () => {
      try {
        await migrateLocalToRemote(userId)
        const remote = await fetchRemote()
        if (!cancelled) setEntries(remote)
      } catch (cause) {
        if (!cancelled) {
          setError(cause.message)
          // Fall back to whatever is on this device so the user still sees
          // something rather than an empty history.
          setEntries(loadLocal())
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [userId])

  const add = useCallback(
    async (draft) => {
      const entry = makeEntry(entries, draft)

      if (!userId) {
        setEntries((current) => addLocal(current, entry))
        return entry
      }

      try {
        const saved = await addRemote(entry, userId)
        setEntries((current) => [saved, ...current])
        return saved
      } catch (cause) {
        setError(cause.message)
        return entry
      }
    },
    [entries, userId],
  )

  const remove = useCallback(
    async (id) => {
      if (!userId) {
        setEntries((current) => removeLocal(current, id))
        return
      }
      const snapshot = entries
      setEntries((current) => current.filter((entry) => entry.id !== id))
      try {
        await removeRemote(id)
      } catch (cause) {
        setError(cause.message)
        setEntries(snapshot)
      }
    },
    [entries, userId],
  )

  const clear = useCallback(async () => {
    if (!userId) {
      setEntries(clearLocal())
      return
    }
    const snapshot = entries
    setEntries([])
    try {
      await clearRemote(userId)
    } catch (cause) {
      setError(cause.message)
      setEntries(snapshot)
    }
  }, [entries, userId])

  return {
    entries,
    isLoading,
    error,
    add,
    remove,
    clear,
    previousBandFor: useCallback((mode) => previousBandFor(entries, mode), [entries]),
  }
}
