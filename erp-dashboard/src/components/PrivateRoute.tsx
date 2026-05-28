import { useEffect, useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function PrivateRoute() {
  const [status, setStatus] = useState<'loading' | 'authed' | 'guest'>('loading')

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setStatus(data.session ? 'authed' : 'guest')
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return
      setStatus(session ? 'authed' : 'guest')
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-[var(--text-muted)]">
        Carregando sessão…
      </div>
    )
  }

  return status === 'authed' ? <Outlet /> : <Navigate to="/login" replace />
}
