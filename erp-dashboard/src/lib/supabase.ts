import { createClient, type Session } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

if (!url || !anonKey) {
  console.error(
    '[supabase] VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY ausentes. Configure no .env.local (dev) e na Vercel (producao).'
  )
}

export const supabase = createClient(url || '', anonKey || '', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'tm-erp-auth',
    flowType: 'pkce',
  },
})

export type AuthSession = Session | null
