// ============================================================
// hooks/useInsightsFinanceiro.ts
// Estado autonomo da pagina Insights IA Financeiro (Fernanda).
// Usa o hook generico useIndependentColeta com os webhooks dedicados.
// ============================================================
import { fetchInsightsFinanceiro, triggerInsightsFinanceiro } from '../services/api'
import { useIndependentColeta, type ColetaState } from './useIndependentColeta'

export type { ColetaState }

export function useInsightsFinanceiro() {
  return useIndependentColeta({
    fetchSnapshot: fetchInsightsFinanceiro,
    trigger: triggerInsightsFinanceiro,
  })
}
