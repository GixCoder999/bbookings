import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

// Validate environment variables
if (!supabaseUrl || !supabaseKey) {
  if (import.meta.env.MODE === 'development') {
    console.warn(
      '⚠️  Missing Supabase environment variables. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file'
    )
  }
}

export const hasSupabaseEnv = Boolean(supabaseUrl && supabaseKey)

export const supabase = hasSupabaseEnv
  ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
      db: {
        schema: 'public',
      },
    })
  : null

// Development helper
if (import.meta.env.MODE === 'development' && hasSupabaseEnv) {
  console.log('✅ Supabase client initialized')
}
