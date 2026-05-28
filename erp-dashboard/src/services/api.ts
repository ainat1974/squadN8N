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

/** Dispara coleta sob demanda no N8N (sem cron). */
export async function triggerColeta(dataInicial: string, dataFinal: string) {
  const webhookUrl = import.meta.env.VITE_N8N_WEBHOOK_URL as string | undefined
  if (!webhookUrl) {
    throw new Error('VITE_N8N_WEBHOOK_URL nao configurada')
  }
  const res = await fetch(webhookUrl, {
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
  contasPagar: (options?: FetchModuloOptions) => fetchModulo('contas-pagar', options),
  contasReceber: (options?: FetchModuloOptions) => fetchModulo('contas-receber', options),
  fluxoCaixa: (options?: FetchModuloOptions) => fetchModulo('fluxo-caixa', options),
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
