import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * Supabase is optional. Without the two env vars the app still runs — history
 * simply stays in localStorage and the sign-in button is hidden — so the project
 * works out of the box with only an Anthropic key.
 *
 * The anon key is meant to be public: every table is protected by Row Level
 * Security (see supabase/schema.sql), so it grants nothing on its own.
 */
export const isSupabaseConfigured = Boolean(url && anonKey)

export const supabase = isSupabaseConfigured ? createClient(url, anonKey) : null
