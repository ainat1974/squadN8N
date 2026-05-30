import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  biometricSupported,
  platformAuthenticatorAvailable,
  rememberCredential,
  tryBiometricLogin,
} from '../lib/biometric'

type Tab = 'entrar' | 'cadastrar'

export default function LoginPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('entrar')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [senhaConfirmar, setSenhaConfirmar] = useState('')
  const [nome, setNome] = useState('')
  const [lembrar, setLembrar] = useState(true)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [hasPlatformAuth, setHasPlatformAuth] = useState(false)
  const triedBiometric = useRef(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate('/visao-geral', { replace: true })
    })
  }, [navigate])

  useEffect(() => {
    platformAuthenticatorAvailable().then(setHasPlatformAuth)
  }, [])

  useEffect(() => {
    if (triedBiometric.current) return
    triedBiometric.current = true
    if (!biometricSupported()) return
    ;(async () => {
      // tentativa silenciosa: so loga se o browser tem credencial salva e
      // pode entregar sem mostrar nenhuma UI. Sem popup chato no carregamento.
      const cred = await tryBiometricLogin('silent')
      if (!cred) return
      await doLogin(cred.id, cred.password, false)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function doLogin(emailArg: string, senhaArg: string, salvarBio: boolean) {
    setErro(null)
    setInfo(null)
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailArg,
        password: senhaArg,
      })
      if (error) throw error
      if (salvarBio) {
        await rememberCredential(emailArg, senhaArg, data.user?.user_metadata?.full_name)
      }
      navigate('/visao-geral', { replace: true })
    } catch (e: any) {
      const msg = e?.message || 'Falha ao entrar'
      if (/invalid login credentials/i.test(msg)) {
        setErro('E-mail ou senha incorretos.')
      } else if (/email not confirmed/i.test(msg)) {
        setErro('E-mail ainda não confirmado. Verifique sua caixa de entrada.')
      } else {
        setErro(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleEntrar(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !senha) {
      setErro('Preencha e-mail e senha.')
      return
    }
    await doLogin(email, senha, lembrar)
  }

  async function handleCadastrar(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    setInfo(null)
    if (!email || !senha) {
      setErro('Preencha e-mail e senha.')
      return
    }
    if (senha.length < 8) {
      setErro('A senha precisa ter pelo menos 8 caracteres.')
      return
    }
    if (senha !== senhaConfirmar) {
      setErro('As senhas não conferem.')
      return
    }
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password: senha,
        options: {
          data: { full_name: nome || null },
          emailRedirectTo: window.location.origin + '/login',
        },
      })
      if (error) throw error
      if (data.session) {
        if (lembrar) await rememberCredential(email, senha, nome)
        navigate('/visao-geral', { replace: true })
      } else {
        setInfo('Cadastro criado. Verifique seu e-mail para confirmar e depois entre.')
        setTab('entrar')
      }
    } catch (e: any) {
      const msg = e?.message || 'Falha ao cadastrar'
      if (/already registered/i.test(msg) || /user already/i.test(msg)) {
        setErro('Este e-mail ja esta cadastrado. Use a aba "Entrar".')
      } else if (/password should be at least/i.test(msg)) {
        setErro('Senha muito curta. Use 8+ caracteres.')
      } else {
        setErro(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleEsqueci() {
    setErro(null)
    setInfo(null)
    if (!email) {
      setErro('Digite seu e-mail acima e clique em "Esqueci minha senha".')
      return
    }
    setLoading(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/login',
      })
      if (error) throw error
      setInfo('Enviamos um link de redefinicao para ' + email + '. Confira sua caixa de entrada.')
    } catch (e: any) {
      setErro(e?.message || 'Falha ao enviar e-mail de recuperacao')
    } finally {
      setLoading(false)
    }
  }

  async function handleBiometriaManual() {
    if (!biometricSupported()) {
      setErro('Seu navegador nao suporta este atalho. Use e-mail e senha.')
      return
    }
    // Modo 'optional' aqui: o browser pode mostrar a UI de selecao e disparar
    // Windows Hello / Touch ID / biometria.
    const cred = await tryBiometricLogin('optional')
    if (!cred) {
      setErro('Nenhuma credencial salva neste dispositivo. Faca login uma vez para habilitar.')
      return
    }
    await doLogin(cred.id, cred.password, false)
  }

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
              {tab === 'entrar' ? 'Entrar para visualizar os painéis' : 'Criar acesso'}
            </h1>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-1 rounded-xl border border-[var(--border)] bg-white/[0.03] p-1">
            <button
              onClick={() => { setTab('entrar'); setErro(null); setInfo(null) }}
              className={`rounded-lg py-2 text-xs font-extrabold transition-colors ${
                tab === 'entrar'
                  ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              Entrar
            </button>
            <button
              onClick={() => { setTab('cadastrar'); setErro(null); setInfo(null) }}
              className={`rounded-lg py-2 text-xs font-extrabold transition-colors ${
                tab === 'cadastrar'
                  ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              Cadastrar
            </button>
          </div>

          <form
            onSubmit={tab === 'entrar' ? handleEntrar : handleCadastrar}
            className="mt-5 space-y-3"
            autoComplete="on"
          >
            {tab === 'cadastrar' && (
              <div>
                <label className="text-[11px] font-extrabold uppercase tracking-tight text-[var(--text-muted)]">
                  Nome (opcional)
                </label>
                <input
                  type="text"
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                  autoComplete="name"
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-black/30 px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
                  placeholder="Seu nome"
                />
              </div>
            )}

            <div>
              <label className="text-[11px] font-extrabold uppercase tracking-tight text-[var(--text-muted)]">
                E-mail
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="username"
                required
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-black/30 px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
                placeholder="voce@empresa.com"
              />
            </div>

            <div>
              <label className="text-[11px] font-extrabold uppercase tracking-tight text-[var(--text-muted)]">
                Senha {tab === 'cadastrar' && <span className="text-[var(--text-muted)]">(min. 8 caracteres)</span>}
              </label>
              <input
                type="password"
                value={senha}
                onChange={e => setSenha(e.target.value)}
                autoComplete={tab === 'entrar' ? 'current-password' : 'new-password'}
                required
                minLength={tab === 'cadastrar' ? 8 : undefined}
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-black/30 px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
                placeholder="••••••••"
              />
            </div>

            {tab === 'cadastrar' && (
              <div>
                <label className="text-[11px] font-extrabold uppercase tracking-tight text-[var(--text-muted)]">
                  Confirmar senha
                </label>
                <input
                  type="password"
                  value={senhaConfirmar}
                  onChange={e => setSenhaConfirmar(e.target.value)}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-black/30 px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
                  placeholder="••••••••"
                />
              </div>
            )}

            <label className="flex cursor-pointer items-center gap-2 pt-1">
              <input
                type="checkbox"
                checked={lembrar}
                onChange={e => setLembrar(e.target.checked)}
                className="h-4 w-4 rounded border-[var(--border)] bg-black/30 accent-[var(--accent)]"
              />
              <span className="text-xs text-[var(--text-secondary)]">
                Lembrar deste dispositivo
                {biometricSupported() && (
                  <span className="text-[var(--text-muted)]">
                    {' '}
                    ({hasPlatformAuth
                      ? 'Windows Hello / Touch ID / biometria'
                      : 'gerenciador de senhas do navegador'}
                    )
                  </span>
                )}
              </span>
            </label>

            {erro && (
              <div className="rounded-lg border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-xs text-[var(--danger)]">
                {erro}
              </div>
            )}
            {info && (
              <div className="rounded-lg border border-[var(--success)]/40 bg-[var(--success)]/10 px-3 py-2 text-xs text-[var(--success)]">
                {info}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-extrabold text-black transition-colors hover:bg-[var(--accent)]/90 disabled:opacity-60"
            >
              {loading ? 'Aguarde…' : tab === 'entrar' ? 'Entrar' : 'Criar acesso'}
            </button>
          </form>

          {tab === 'entrar' && (
            <div className="mt-4 flex flex-col gap-2 text-center">
              {biometricSupported() && (
                <button
                  onClick={handleBiometriaManual}
                  disabled={loading}
                  className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-bold text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--accent)]"
                >
                  {hasPlatformAuth
                    ? 'Entrar com Windows Hello / Touch ID / biometria'
                    : 'Entrar com credencial salva neste navegador'}
                </button>
              )}
              <button
                onClick={handleEsqueci}
                disabled={loading}
                className="text-xs font-bold text-[var(--text-muted)] hover:text-[var(--accent)]"
              >
                Esqueci minha senha
              </button>
            </div>
          )}

          <div className="mt-6 grid gap-2 rounded-xl border border-[var(--border)] bg-white/[0.03] p-4">
            <p className="m-0 text-xs font-extrabold text-[var(--text-secondary)]">Como funciona</p>
            <p className="m-0 text-xs leading-relaxed text-[var(--text-muted)]">
              No primeiro acesso, cadastre seu e-mail e senha. O dispositivo memoriza a credencial
              no gerenciador do navegador: nas próximas vezes, basta autorizar com{' '}
              <strong className="text-[var(--text-secondary)]">Windows Hello</strong> /{' '}
              <strong className="text-[var(--text-secondary)]">Touch ID</strong> /{' '}
              <strong className="text-[var(--text-secondary)]">Face ID</strong> ou digital. A
              sessão fica guardada com segurança via Supabase, válida em qualquer dispositivo (PC,
              Mac, Android, iPhone).
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
