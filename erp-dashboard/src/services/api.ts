// ============================================================
// services/api.ts — Serviço de dados ERP via N8N webhooks
// ============================================================

// URL base: sempre aponta para o webhook N8N direto
// Ignora VITE_API_URL que pode ter path extra (ex: /api) causando URL errada
const N8N_HOST = 'https://workflows.tmrodrigues.tech'
const BASE_URL = N8N_HOST

export interface FetchModuloOptions {
  periodo?: string
  dias?: number
}

async function fetchModulo(modulo: string, options: FetchModuloOptions = {}) {
  const params = new URLSearchParams({ modulo })
  if (options.periodo) params.set('periodo', options.periodo)
  if (options.dias) params.set('dias', String(options.dias))

  const res = await fetch(`${BASE_URL}/webhook/erp?${params.toString()}`, {
    headers: { 'Accept': 'application/json' }
  })
  if (!res.ok) throw new Error(`Erro ao buscar ${modulo}: ${res.status}`)
  return res.json()
}

export const api = {
  resumo: (options?: FetchModuloOptions) => fetchModulo('resumo', options),
  vendas: (options?: FetchModuloOptions) => fetchModulo('vendas', options),
  estoque: (options?: FetchModuloOptions) => fetchModulo('estoque', options),
  contasPagar: (options?: FetchModuloOptions) => fetchModulo('contas-pagar', options),
  contasReceber: (options?: FetchModuloOptions) => fetchModulo('contas-receber', options),
  fluxoCaixa: (options?: FetchModuloOptions) => fetchModulo('fluxo-caixa', options),
}

// Formatar moeda pt-BR
export function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

// Formatar data pt-BR
export function formatDate(iso: string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR')
}

// Formatar número
export function formatNum(value: number, decimals = 0): string {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: decimals }).format(value)
}
