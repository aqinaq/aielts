// Attempt history.
//
// Two backends behind one entry shape:
//   - signed out -> localStorage (works offline, no account, nothing leaves the browser)
//   - signed in  -> Supabase, scoped to the user by Row Level Security
//
// On first sign-in the local attempts are uploaded and then cleared, so a guest
// who decides to create an account keeps the practice they already did.

import { supabase } from './supabase'
import { normalizeBands } from '../../api/schema.js'

const STORAGE_KEY = 'aielts.history.v1'
const MAX_LOCAL_ENTRIES = 40
const MAX_REMOTE_ENTRIES = 200
const MAX_STORED_TEXT = 4000

/**
 * The shape every component consumes, whichever backend produced it:
 * { id, at, mode, band, level, task, text, previousBand, metrics, result }
 */
function canonicalEntry(entry) {
  if (!entry.result?.criteria) return entry
  const mode = entry.mode === 'write' ? 'writing' : 'speaking'
  const result = normalizeBands(entry.result, mode)
  return {
    ...entry,
    result,
    band: result.overall_band,
    previousBand: result.overall_band !== entry.band ? null : entry.previousBand,
  }
}

function toEntry(row) {
  return canonicalEntry({
    id: row.id,
    at: new Date(row.created_at).getTime(),
    mode: row.mode,
    band: Number(row.band),
    level: row.level,
    task: row.task ?? '',
    text: row.text ?? '',
    previousBand: row.previous_band == null ? null : Number(row.previous_band),
    metrics: row.metrics ?? null,
    result: row.result,
  })
}

const toRow = (entry, userId) => ({
  user_id: userId,
  created_at: new Date(entry.at).toISOString(),
  mode: entry.mode,
  band: entry.band,
  level: entry.level,
  task: entry.task,
  text: entry.text,
  previous_band: entry.previousBand,
  metrics: entry.metrics,
  result: entry.result,
})

/** Band of the most recent attempt in the same mode, or null on a first try. */
export function previousBandFor(entries, mode) {
  const previous = entries.find((entry) => entry.mode === mode && Number.isFinite(entry.band))
  return previous ? previous.band : null
}

/** Builds a canonical entry from a finished analysis. */
export function makeEntry(entries, { mode, task, text, result, metrics }) {
  if (!Number.isFinite(result.overall_band)) throw new Error('Cannot save an unscored attempt')
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: Date.now(),
    mode,
    band: result.overall_band,
    level: result.level,
    task: task.slice(0, MAX_STORED_TEXT),
    text: text.slice(0, MAX_STORED_TEXT),
    previousBand: previousBandFor(entries, mode),
    metrics: metrics ?? null,
    result,
  }
}

// --- local backend ----------------------------------------------------------

export function loadLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.map(canonicalEntry) : []
  } catch {
    // Corrupted or unavailable storage (private mode, quota) — start clean
    // rather than breaking the whole app.
    return []
  }
}

function persistLocal(entries) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {
    /* quota exceeded — the in-memory list still works for this session */
  }
  return entries
}

export const addLocal = (entries, entry) =>
  persistLocal([entry, ...entries].slice(0, MAX_LOCAL_ENTRIES))

export const removeLocal = (entries, id) =>
  persistLocal(entries.filter((entry) => entry.id !== id))

export const clearLocal = () => persistLocal([])

// --- Supabase backend -------------------------------------------------------

export async function fetchRemote() {
  const { data, error } = await supabase
    .from('attempts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(MAX_REMOTE_ENTRIES)

  if (error) throw error
  return data.map(toEntry)
}

export async function addRemote(entry, userId) {
  const { data, error } = await supabase
    .from('attempts')
    .insert(toRow(entry, userId))
    .select()
    .single()

  if (error) throw error
  return toEntry(data)
}

export async function removeRemote(id) {
  const { error } = await supabase.from('attempts').delete().eq('id', id)
  if (error) throw error
}

export async function clearRemote(userId) {
  const { error } = await supabase.from('attempts').delete().eq('user_id', userId)
  if (error) throw error
}

/**
 * Uploads whatever the user recorded while signed out, then clears local
 * storage so the same attempts can't be uploaded twice on the next reload.
 * Returns how many were migrated.
 */
export async function migrateLocalToRemote(userId) {
  const local = loadLocal()
  if (local.length === 0) return 0

  const scored = local.filter((entry) => Number.isFinite(entry.band))
  if (scored.length === 0) return 0

  const { error } = await supabase
    .from('attempts')
    .insert(scored.map((entry) => toRow(entry, userId)))

  if (error) throw error

  persistLocal(local.filter((entry) => !Number.isFinite(entry.band)))
  return scored.length
}
