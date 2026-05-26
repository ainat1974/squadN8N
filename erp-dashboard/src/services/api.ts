// ============================================================
// services/api.ts — Serviço de dados ERP via N8N webhooks
// ============================================================

// URL base: sempre aponta para o webhook N8N direto
// Ignora VITE_API_URL que pode ter path extra (ex: /api) causando URL errada
const N8N_HOST = 'https://workflows.tmrodrigues.tech'
const BASE_URL = N8N_HOST

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
