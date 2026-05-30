// ============================================================
// services/api.ts — Serviço de dados ERP via N8N webhooks
// ============================================================

const N8N_HOST = 'https://workflows.tmrodrigues.tech'
const BASE_URL = N8N_HOST

export interface FetchModuloOptions {
  dataInicial?: string
  dataFinal?: string
  dias?: number
}

async function fetchModulo(modulo: string, options: FetchModuloOptions = {}) {
  const params = new URLSearchParams({ modulo })
  if (options.dataInicial) params.set('dataInicial', options.dataInicial)
  if (options.dataFinal) params.set('dataFinal', options.dataFinal)
  if (options.dias) params.set('dias', String(options.dias))

  const res = await fetch(`${BASE_URL}/webhook/erp?${params.toString()}`, {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`Erro ao buscar ${modulo}: ${res.status}`)
  const json = await res.json()
  if (json && json.success === false) {
    throw new Error(json.error || `Dados indisponiveis para ${modulo}`)
  }
  return json
}

/** URL do webhook que dispara a coleta. Usa a env quando definida; senao
 *  cai no mesmo host das leituras, garantindo que o botao Atualizar funcione
 *  mesmo sem VITE_N8N_WEBHOOK_URL configurada no build. */
const TRIGGER_WEBHOOK_URL =
  (import.meta.env.VITE_N8N_WEBHOOK_URL as string | undefined) || `${N8N_HOST}/webhook/atualizar`

/** Dispara coleta sob demanda no N8N (sem cron). */
export async function triggerColeta(dataInicial: string, dataFinal: string) {
  const res = await fetch(TRIGGER_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dataInicial, dataFinal }),
  })
  if (!res.ok) throw new Error(`Falha ao iniciar coleta: ${res.status}`)
}

export const api = {
  resumo: (options?: FetchModuloOptions) => fetchModulo('resumo', options),
  vendas: (options?: FetchModuloOptions) => fetchModulo('vendas', options),
  estoque: (options?: FetchModuloOptions) => fetchModulo('estoque', options),
  insights: (options?: FetchModuloOptions) => fetchModulo('insights', options),
  financeiroIA: (options?: FetchModuloOptions) => fetchModulo('financeiro-ia', options),
  pcpIA: (options?: FetchModuloOptions) => fetchModulo('pcp-ia', options),
  contasPagar: (options?: FetchModuloOptions) => fetchModulo('contas-pagar', options),
  contasReceber: (options?: FetchModuloOptions) => fetchModulo('contas-receber', options),
  fluxoCaixa: (options?: FetchModuloOptions) => fetchModulo('fluxo-caixa', options),
}

// ============================================================
// Workflow INDEPENDENTE: Insights IA Financeiro (Fernanda)
// Webhooks proprios, snapshot isolado, intervalo proprio.
// ============================================================

/** Le o ultimo snapshot da analise financeira gerada pela Fernanda. */
export async function fetchInsightsFinanceiro() {
  const res = await fetch(`${BASE_URL}/webhook/dados-financeiro-ia`, {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`Erro ao buscar insights financeiro: ${res.status}`)
  const json = await res.json()
  if (json && json.success === false) {
    throw new Error(json.error || 'Análise financeira ainda não gerada')
  }
  return json
}

/** Dispara a coleta + analise da Fernanda para o intervalo informado. */
export async function triggerInsightsFinanceiro(dataInicial: string, dataFinal: string) {
  const res = await fetch(`${N8N_HOST}/webhook/coletar-financeiro-ia`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dataInicial, dataFinal }),
  })
  if (!res.ok) throw new Error(`Falha ao iniciar analise financeira: ${res.status}`)
}

// ============================================================
// Workflow INDEPENDENTE: Visao Geral (landing de decisao, sem GPT)
// ============================================================

/** Le o snapshot da Visao Geral (KPIs, prioridades, saude, graficos). */
export async function fetchOverview() {
  const res = await fetch(`${BASE_URL}/webhook/dados-overview`, {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`Erro ao buscar Visao Geral: ${res.status}`)
  const json = await res.json()
  if (json && json.success === false) {
    throw new Error(json.error || 'Visao Geral ainda nao coletada')
  }
  return json
}

/** Dispara a coleta da Visao Geral para o intervalo informado. */
export async function triggerOverview(dataInicial: string, dataFinal: string) {
  const res = await fetch(`${N8N_HOST}/webhook/coletar-overview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dataInicial, dataFinal }),
  })
  if (!res.ok) throw new Error(`Falha ao iniciar coleta da Visao Geral: ${res.status}`)
}

export function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

export function formatDate(iso: string): string {
  if (!iso) return '—'
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [year, month, day] = iso.split('-')
    return `${day}/${month}/${year}`
  }
  return new Date(iso).toLocaleDateString('pt-BR')
}

export function formatNum(value: number, decimals = 0): string {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: decimals }).format(value)
}
