/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js'

// Extracted from main.jsx — single source of truth for the Supabase client.
// In production this will point to Azure PostgreSQL Flexible Server
// via a compatible Supabase-on-Azure deployment or direct pg connection.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('[PMO Platform] Missing required env vars: VITE_SUPABASE_URL and/or VITE_SUPABASE_ANON_KEY. Check .env.local or CI secrets.')
}

export const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
