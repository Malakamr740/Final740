import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder-assessment-platform.supabase.co'
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'placeholder-anon-key'

export const isSupabaseConfigured = Boolean(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
)

if (!isSupabaseConfigured) {
  console.warn(
    'Notice: VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY are not configured in environment. The platform will operate in demo/preview mode.'
  )
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey)
