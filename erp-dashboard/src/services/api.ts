// ============================================================
// services/api.ts — Serviço de dados ERP via N8N webhooks
// ============================================================

// URL base: usa VITE_API_URL se apontar para o servidor correto, senão usa o N8N direto
const RAW_API_URL = import.meta.env.VITE_API_URL || ''
// Se VITE_API_URL contiver 'workflows.tmrodrigues.tech', usa ele; senão usa o padrão
const BASE_URL = RAW_API_URL.includes('workflows.tmrodrigues.tech')
  ? RAW_API_URL.replace(/\/+$/, '')
  : 'https://workflows.tmrodrigues.tech'

async function fetchModulo(modulo: string) {
  const res = await fetch(`${BASE_URL}/webhook/erp?modulo=${modulo}`, {
    headers: { 'Accept': 'application/json' }
  })
  if (!res.ok) throw new Error(`Erro ao buscar ${modulo}: ${res.status}`)
  return res.json()
}

export const api = {
  resumo: () => fetchModulo('resumo'),
  vendas: () => fetchModulo('vendas'),
  estoque: () => fetchModulo('estoque'),
  contasPagar: () => fetchModulo('contas-pagar'),
  contasReceber: () => fetchModulo('contas-receber'),
  fluxoCaixa: () => fetchModulo('fluxo-caixa'),
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
