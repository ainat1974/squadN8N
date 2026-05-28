/**
 * Atalho de login com biometria (Face ID / Touch ID / Windows Hello / Android).
 *
 * Estrategia: usar a Web Credential Management API (PasswordCredential) para
 * pedir ao gerenciador de senhas do navegador / SO que guarde as credenciais.
 * Quando o usuario volta, chamamos navigator.credentials.get() — o navegador
 * dispara o desbloqueio biometrico do dispositivo automaticamente em quem tiver
 * suporte (Chrome/Edge desktop com Windows Hello/Touch ID, Chrome Android,
 * Safari iOS via password autofill).
 *
 * Em browsers sem PasswordCredential (Firefox / alguns Safari), os atributos
 * autocomplete do form ja garantem o "salvar senha" tradicional, que tambem
 * desbloqueia com biometria via gerenciador do SO.
 */

const PREF_KEY = 'tm-erp-biometric-enabled'

type StoredCred = { id: string; password: string }

declare global {
  interface Window {
    PasswordCredential?: typeof PasswordCredential
  }
  interface CredentialsContainer {
    store?(credential: Credential): Promise<Credential>
  }
  // eslint-disable-next-line no-var
  var PasswordCredential: {
    new (data: { id: string; password: string; name?: string }): Credential
    prototype: Credential
  } | undefined
}

export function biometricSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.PasswordCredential === 'function'
}

export function biometricPreference(): boolean {
  try {
    return localStorage.getItem(PREF_KEY) === '1'
  } catch {
    return false
  }
}

export function setBiometricPreference(enabled: boolean) {
  try {
    if (enabled) localStorage.setItem(PREF_KEY, '1')
    else localStorage.removeItem(PREF_KEY)
  } catch {
    /* storage indisponivel — ignora */
  }
}

export async function rememberCredential(email: string, password: string, name?: string) {
  if (!biometricSupported() || !navigator.credentials?.store) return false
  try {
    const PC = window.PasswordCredential!
    const cred = new PC({ id: email, password, name: name || email })
    await navigator.credentials.store(cred)
    setBiometricPreference(true)
    return true
  } catch (err) {
    console.warn('[biometric] falha ao guardar credencial', err)
    return false
  }
}

export async function tryBiometricLogin(): Promise<StoredCred | null> {
  if (!biometricSupported() || !navigator.credentials?.get) return null
  try {
    const cred = (await navigator.credentials.get({
      password: true,
      mediation: 'optional',
    } as CredentialRequestOptions)) as (Credential & { password?: string; id?: string }) | null
    if (!cred || !('password' in cred) || !cred.password || !cred.id) return null
    return { id: cred.id, password: cred.password }
  } catch (err) {
    console.warn('[biometric] falha ao recuperar credencial', err)
    return null
  }
}

export async function preventAutoSilent() {
  try {
    await navigator.credentials?.preventSilentAccess?.()
  } catch {
    /* ignora */
  }
}
