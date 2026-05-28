/**
 * Atalho de login com gerenciador de senhas + biometria.
 *
 * Cobre Desktop e Mobile com a Web Credential Management API:
 *   - Chrome / Edge no Windows: Windows Hello (digital, PIN, rosto)
 *   - Chrome / Safari no macOS: Touch ID
 *   - Chrome no Android: digital / face unlock
 *   - Safari no iOS: Face ID / Touch ID via password autofill
 *
 * Em browsers sem PasswordCredential (Firefox, alguns Safari antigos),
 * os atributos autocomplete do form ja garantem o "salvar senha" tradicional,
 * que tambem desbloqueia com biometria via gerenciador do sistema operacional.
 */

const PREF_KEY = 'tm-erp-biometric-enabled'
const TRIED_KEY = 'tm-erp-biometric-prompted'

type StoredCred = { id: string; password: string }

declare global {
  interface Window {
    PasswordCredential?: typeof PasswordCredential
    PublicKeyCredential?: typeof PublicKeyCredential
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

/**
 * Verifica se o dispositivo tem authenticator de plataforma disponivel
 * (Windows Hello configurado, Touch ID, biometria do celular).
 * Util pra customizar o copy do botao no Desktop sem biometria.
 */
export async function platformAuthenticatorAvailable(): Promise<boolean> {
  try {
    const PKC = (window as Window).PublicKeyCredential
    if (!PKC || typeof PKC.isUserVerifyingPlatformAuthenticatorAvailable !== 'function') {
      return false
    }
    return await PKC.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch {
    return false
  }
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

/**
 * Busca credenciais salvas no gerenciador de senhas.
 * - mediation 'silent': so devolve se o browser ja confia (sem mostrar UI).
 *   Ideal para tentativa automatica no carregamento da pagina.
 * - mediation 'optional': mostra UI de selecao se necessario, dispara biometria.
 *   Ideal pra clique manual no botao "Entrar com biometria".
 */
export async function tryBiometricLogin(
  mode: 'silent' | 'optional' = 'optional'
): Promise<StoredCred | null> {
  if (!biometricSupported() || !navigator.credentials?.get) return null
  try {
    const cred = (await navigator.credentials.get({
      password: true,
      mediation: mode,
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

/**
 * Marca que ja tentamos prompt automatico nesta aba — evita reprompt em
 * navegacoes internas. Usar antes de chamar tryBiometricLogin('optional')
 * automatico.
 */
export function markPromptedThisSession() {
  try {
    sessionStorage.setItem(TRIED_KEY, '1')
  } catch { /* ignora */ }
}

export function alreadyPromptedThisSession(): boolean {
  try {
    return sessionStorage.getItem(TRIED_KEY) === '1'
  } catch {
    return false
  }
}
