/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js'

// Extracted from main.jsx — single source of truth for the Supabase client.
// In production this will point to Azure PostgreSQL Flexible Server
// via a compatible Supabase-on-Azure deployment or direct pg connection.
const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string) ||
  'https://qffzpdhnrkfbkzgrnvsy.supabase.co'

const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmZnpwZGhucmtmYmt6Z3JudnN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0OTYwMjUsImV4cCI6MjA5MDA3MjAyNX0.qI2IvYWtoDuvyR0ySfElBidyelIpB1sjXF6GVnjfiG0'

export const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
