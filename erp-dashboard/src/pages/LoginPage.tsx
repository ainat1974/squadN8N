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
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center">
      <div className="bg-[#1e293b] rounded-2xl p-10 shadow-2xl w-full max-w-sm border border-[#475569] text-center">
        <div className="text-4xl mb-4">⚡</div>
        <h1 className="text-[#f1f5f9] font-bold text-2xl">Tech Malhas</h1>
        <p className="text-[#94a3b8] text-sm mt-1 mb-8">Dashboard ERP — Acesso Executivo</p>

        <button
          onClick={() => login()}
          className="w-full flex items-center justify-center gap-3 bg-white text-gray-700 font-medium py-3 px-4 rounded-xl hover:bg-gray-100 transition-colors text-sm"
        >
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"/>
            <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17z"/>
            <path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 0 1 0-3.04V5.41H1.83a8 8 0 0 0 0 7.18z"/>
            <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.4L4.5 7.49a4.77 4.77 0 0 1 4.48-3.3z"/>
          </svg>
          Entrar com Google
        </button>

        <p className="text-[#64748b] text-xs mt-6">Apenas e-mails autorizados têm acesso.</p>
      </div>
    </div>
  )
}
