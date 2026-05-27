import { useGoogleLogin } from '@react-oauth/google'
import { useNavigate } from 'react-router-dom'

const allowedEmails = (import.meta.env.VITE_ALLOWED_EMAILS || '')
  .split(',')
  .map((e: string) => e.trim().toLowerCase())

export default function LoginPage() {
  const navigate = useNavigate()

  const login = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
        })
        const user = await res.json()

        if (!allowedEmails.includes(user.email.toLowerCase())) {
          alert('Acesso não autorizado para este e-mail.')
          return
        }

        sessionStorage.setItem('auth_token', tokenResponse.access_token)
        sessionStorage.setItem('user_info', JSON.stringify(user))
        navigate('/visao-geral')
      } catch {
        alert('Erro ao autenticar. Tente novamente.')
      }
    },
    onError: () => alert('Falha no login com Google.'),
  })

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="panel w-full max-w-md">
        <div className="p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <div className="brand-mark">TM</div>
            <div className="min-w-0">
              <p className="m-0 text-sm font-extrabold text-[var(--text-primary)]">Tech Malhas</p>
              <p className="m-0 text-xs text-[var(--text-muted)]">Dashboard ERP — Acesso Executivo</p>
            </div>
          </div>

          <div className="mt-6">
            <p className="m-0 text-xs font-extrabold uppercase tracking-tight text-[var(--accent)]">
              Command Center
            </p>
            <h1 className="mt-2 text-2xl font-extrabold text-[var(--text-primary)]">
              Entrar para visualizar os painéis
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
              Autenticação com Google e acesso restrito por lista de e-mails autorizados.
            </p>
          </div>

          <button
            onClick={() => login()}
            className="mt-7 w-full rounded-xl border border-[var(--border)] bg-white text-black/80 font-extrabold py-3 px-4 transition-colors hover:bg-white/90"
          >
            <span className="flex items-center justify-center gap-3 text-sm">
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"/>
                <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17z"/>
                <path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 0 1 0-3.04V5.41H1.83a8 8 0 0 0 0 7.18z"/>
                <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.4L4.5 7.49a4.77 4.77 0 0 1 4.48-3.3z"/>
              </svg>
              Entrar com Google
            </span>
          </button>

          <div className="mt-6 grid gap-2 rounded-xl border border-[var(--border)] bg-white/[0.03] p-4">
            <p className="m-0 text-xs font-extrabold text-[var(--text-secondary)]">Dica</p>
            <p className="m-0 text-xs leading-relaxed text-[var(--text-muted)]">
              Se o login falhar, confira as variáveis <span className="font-bold text-[var(--text-secondary)]">VITE_ALLOWED_EMAILS</span> e
              <span className="font-bold text-[var(--text-secondary)]"> VITE_GOOGLE_CLIENT_ID</span>.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
