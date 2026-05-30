// ============================================================
// hooks/useOverview.ts
// Estado autonomo da Visao Geral (landing). Workflow proprio,
// intervalo proprio, sem GPT.
// ============================================================
import { fetchOverview, triggerOverview } from '../services/api'
import { useIndependentColeta } from './useIndependentColeta'

export function useOverview() {
  return useIndependentColeta({
    fetchSnapshot: fetchOverview,
    trigger: triggerOverview,
    pollMaxMs: 240_000,
  })
}
