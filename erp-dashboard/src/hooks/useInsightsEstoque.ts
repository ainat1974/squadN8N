// ============================================================
// hooks/useInsightsEstoque.ts
// Estado autonomo da pagina Insights IA Estoque (Paulo PCP).
// Espelha o padrao do useInsightsFinanceiro.
// ============================================================
import { fetchInsightsEstoque, triggerInsightsEstoque } from '../services/api'
import { useIndependentColeta, type ColetaState } from './useIndependentColeta'

export type { ColetaState }

export function useInsightsEstoque() {
  return useIndependentColeta({
    fetchSnapshot: fetchInsightsEstoque,
    trigger: triggerInsightsEstoque,
    pollMaxMs: 240_000,
  })
}
