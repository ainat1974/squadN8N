import { NavLink } from 'react-router-dom'
import DateRangePicker from '../components/DateRangePicker'
import { EmptyState, LoadingBlock, PageHeader, Panel, StatusPill } from '../components/DashboardPrimitives'
import { formatBRL, formatNum } from '../services/api'
import { useInsightsEstoque } from '../hooks/useInsightsEstoque'

// =====================================================================
// PAULO PCP (Insights IA Estoque) — agente real, workflow dedicado.
// Use PREVIEW_PAULO=true apenas para regredir a UI ao mock visual.
// =====================================================================
const PREVIEW_PAULO = false

type AbcResumo = {
  classe: string
  skus: number
  percentual_skus: number
  percentual_receita: number
  ticket_medio: number
  cobertura_media_dias: number
  descricao: string
}
type AbcDetalhe = {
  posicao: number
  classe: string
  codigo: string
  produto: string
  variacao: string
  vendido: number
  receita: number
  pct_receita: number
}
type ReposicaoItem = {
  codigo: string
  produto: string
  variacao: string
  estoque_atual: number
  vendido_periodo: number
  cobertura_dias: number
  urgencia: string
}
type IndicadorEst = { label?: string; valor?: string; tom?: string }
type BlocoEst = {
  prioridade?: number
  severidade?: string
  categoria?: string
  titulo?: string
  valor?: string
  conteudo?: string
}
type AlertaEst = { tipo?: string; prioridade?: string; titulo?: string; detalhe?: string }
type RecomendacaoEst = {
  acao?: string
  prioridade?: string
  produto?: string
  motivo?: string
  fundamentacao?: string
  impacto_esperado?: string
}
type GlossarioEst = { termo?: string; definicao?: string }

type AnaliseEstoque = {
  gerado_em?: string
  modelo?: string
  agente?: string
  resumo_executivo?: string
  diagnostico?: string
  metodologia?: string
  saude_estoque?: string
  blocos?: BlocoEst[]
  indicadores?: IndicadorEst[]
  alertas?: AlertaEst[]
  recomendacoes?: RecomendacaoEst[]
  glossario?: GlossarioEst[]
  reposicao_urgente?: ReposicaoItem[]
  curva_abc?: { resumo: AbcResumo[]; detalhes: AbcDetalhe[] }
  periodo?: { inicio?: string; fim?: string }
}

const PAULO_MOCK = {
  agente: 'Paulo — PhD em PCP e Operações',
  modelo: 'gpt-4o',
  gerado_em: new Date().toISOString(),
  periodo: { inicio: '2026-05-01', fim: '2026-05-28' },
  saude_estoque: 'atencao' as const,
  resumo_executivo:
    'No intervalo de 01/05 a 28/05, o estoque opera com 47 variações em estado crítico (≤2 unidades) e 132 em alerta (≤5 unidades), enquanto a curva de vendas mostra concentração em poucos SKUs. Existe risco real de ruptura no top de giro, e simultaneamente capital empoçado em cores/tamanhos de baixa rotação. A prioridade #1 é a reposição da BABY LOOK COTTON PREMIUM PRETO P, líder de venda com cobertura de menos de 2 dias.',
  diagnostico:
    'A leitura cruzada estoque × vendas revela um descompasso clássico de mix: os SKUs que mais giram estão entre os mais baixos em saldo, enquanto os que pouco giram concentram capital. Esse padrão indica que o reposicionamento não está acompanhando a demanda observada — provavelmente por inércia no plano de produção/compra (lead time longo) ou por seleção de mix baseada em histórico sazonal e não em sinal recente. Em paralelo, o índice de cobertura média de 18 dias está saudável no agregado, mas mascara extremos perigosos quando se quebra por variação. Recomendo migrar a política de reposição de "média mensal" para "cobertura mínima por SKU classe A".',
  metodologia:
    'Apliquei três frameworks: (1) ABC por venda no intervalo (classe A = top 20% da receita); (2) cobertura em dias = estoque atual ÷ velocidade média diária de venda; (3) índice de ruptura = % de SKUs classe A com cobertura ≤ 5 dias. Cobertura ≥ 30 dias em classe C é tratada como capital parado.',
  blocos: [
    {
      prioridade: 1,
      severidade: 'critico' as const,
      categoria: 'Ruptura iminente',
      titulo: '3 SKUs classe A com cobertura < 2 dias',
      valor: '3 SKUs',
      conteudo:
        'BABY LOOK COTTON PREMIUM PRETO P, REGATA SUPLEX BRANCO M e CALÇA MOLETOM CINZA G. São os líderes de venda do período e estão prestes a romper. Acionar reposição emergencial hoje.',
    },
    {
      prioridade: 2,
      severidade: 'critico' as const,
      categoria: 'Capital parado',
      titulo: 'R$ 87.420 em SKUs classe C com cobertura > 90 dias',
      valor: 'R$ 87.420',
      conteudo:
        'Concentrado em variações de cor pouco vendidas (off, mostarda, salmão) e tamanhos extremos (PP/XGG). Considerar promoção segmentada para acelerar giro e liberar capital.',
    },
    {
      prioridade: 3,
      severidade: 'atencao' as const,
      categoria: 'Mix descalibrado',
      titulo: 'Top 3 produtos respondem por 38% da receita do período',
      valor: '38%',
      conteudo:
        'Concentração saudável, mas reforça que a reposição precisa priorizar esses SKUs. Risco se algum deles esgotar — afeta diretamente o faturamento.',
    },
    {
      prioridade: 4,
      severidade: 'ok' as const,
      categoria: 'Saúde geral',
      titulo: 'Cobertura média do mix ativo está saudável',
      valor: '18 dias',
      conteudo:
        'No agregado, o estoque suporta ~3 semanas de venda no ritmo atual. O problema está na distribuição entre SKUs, não no volume total.',
    },
  ],
  indicadores: [
    { label: 'SKUs críticos (≤2un)', valor: '47', tom: 'critico' },
    { label: 'SKUs em alerta (≤5un)', valor: '132', tom: 'atencao' },
    { label: 'Capital total em estoque', valor: 'R$ 612.840', tom: 'positivo' },
    { label: 'Cobertura média', valor: '18 dias', tom: 'positivo' },
    { label: 'Giro estimado (mês)', valor: '1,6×', tom: 'atencao' },
  ],
  reposicao_urgente: [
    { codigo: '02038412', produto: 'BABY LOOK COTTON PREMIUM', variacao: 'PRETO / P', estoque_atual: 1, vendido_periodo: 47, cobertura_dias: 0.6, urgencia: 'critico' },
    { codigo: '04701233', produto: 'REGATA SUPLEX', variacao: 'BRANCO / M', estoque_atual: 2, vendido_periodo: 38, cobertura_dias: 1.5, urgencia: 'critico' },
    { codigo: '08812501', produto: 'CALÇA MOLETOM PELUCIADO', variacao: 'CINZA / G', estoque_atual: 2, vendido_periodo: 31, cobertura_dias: 1.8, urgencia: 'critico' },
    { codigo: '02038413', produto: 'BABY LOOK COTTON PREMIUM', variacao: 'BRANCO / M', estoque_atual: 4, vendido_periodo: 28, cobertura_dias: 4.0, urgencia: 'alto' },
    { codigo: '06324801', produto: 'BLUSA RIBANA CANELADA', variacao: 'PRETO / P', estoque_atual: 5, vendido_periodo: 22, cobertura_dias: 6.4, urgencia: 'alto' },
    { codigo: '09127342', produto: 'SHORT TACTEL', variacao: 'AZUL MARINHO / M', estoque_atual: 5, vendido_periodo: 18, cobertura_dias: 7.8, urgencia: 'alto' },
    { codigo: '02038414', produto: 'BABY LOOK COTTON PREMIUM', variacao: 'OFF / G', estoque_atual: 3, vendido_periodo: 12, cobertura_dias: 7.0, urgencia: 'medio' },
    { codigo: '11293048', produto: 'SHORT BERMUDA TACTEL', variacao: 'PRETO / GG', estoque_atual: 4, vendido_periodo: 9, cobertura_dias: 12.4, urgencia: 'medio' },
    { codigo: '03987112', produto: 'CAMISETA BÁSICA COTTON', variacao: 'PRETO / M', estoque_atual: 3, vendido_periodo: 26, cobertura_dias: 3.2, urgencia: 'critico' },
    { codigo: '03987113', produto: 'CAMISETA BÁSICA COTTON', variacao: 'BRANCO / G', estoque_atual: 5, vendido_periodo: 24, cobertura_dias: 5.8, urgencia: 'alto' },
    { codigo: '05642178', produto: 'LEGGING SUPLEX', variacao: 'PRETO / P', estoque_atual: 2, vendido_periodo: 21, cobertura_dias: 2.6, urgencia: 'critico' },
    { codigo: '05642179', produto: 'LEGGING SUPLEX', variacao: 'PRETO / M', estoque_atual: 4, vendido_periodo: 20, cobertura_dias: 5.6, urgencia: 'alto' },
    { codigo: '07811923', produto: 'BLUSA MANGA LONGA RIBANA', variacao: 'CINZA / M', estoque_atual: 3, vendido_periodo: 17, cobertura_dias: 4.9, urgencia: 'alto' },
    { codigo: '12056784', produto: 'SHORT BERMUDA MOLETOM', variacao: 'PRETO / M', estoque_atual: 6, vendido_periodo: 16, cobertura_dias: 10.5, urgencia: 'medio' },
    { codigo: '04812370', produto: 'BABY LOOK GOLA V', variacao: 'PRETO / P', estoque_atual: 2, vendido_periodo: 15, cobertura_dias: 3.7, urgencia: 'critico' },
    { codigo: '04812371', produto: 'BABY LOOK GOLA V', variacao: 'BRANCO / M', estoque_atual: 4, vendido_periodo: 14, cobertura_dias: 8.0, urgencia: 'alto' },
    { codigo: '08234561', produto: 'CALÇA LEGGING FITNESS', variacao: 'AZUL / M', estoque_atual: 5, vendido_periodo: 13, cobertura_dias: 10.8, urgencia: 'medio' },
    { codigo: '06789102', produto: 'TOP FITNESS CROPPED', variacao: 'PRETO / P', estoque_atual: 3, vendido_periodo: 13, cobertura_dias: 6.5, urgencia: 'alto' },
    { codigo: '06789103', produto: 'TOP FITNESS CROPPED', variacao: 'PRETO / M', estoque_atual: 4, vendido_periodo: 12, cobertura_dias: 9.3, urgencia: 'medio' },
    { codigo: '09456321', produto: 'BLUSÃO MOLETOM CAPUZ', variacao: 'CINZA / G', estoque_atual: 5, vendido_periodo: 11, cobertura_dias: 12.7, urgencia: 'medio' },
    { codigo: '02038415', produto: 'BABY LOOK COTTON PREMIUM', variacao: 'AZUL / P', estoque_atual: 3, vendido_periodo: 11, cobertura_dias: 7.6, urgencia: 'alto' },
    { codigo: '11293049', produto: 'SHORT BERMUDA TACTEL', variacao: 'MARINHO / G', estoque_atual: 6, vendido_periodo: 10, cobertura_dias: 16.8, urgencia: 'medio' },
    { codigo: '04701234', produto: 'REGATA SUPLEX', variacao: 'PRETO / M', estoque_atual: 4, vendido_periodo: 10, cobertura_dias: 11.2, urgencia: 'medio' },
    { codigo: '07811924', produto: 'BLUSA MANGA LONGA RIBANA', variacao: 'PRETO / G', estoque_atual: 5, vendido_periodo: 9, cobertura_dias: 15.6, urgencia: 'medio' },
    { codigo: '13478965', produto: 'CONJUNTO FITNESS', variacao: 'PRETO / P', estoque_atual: 3, vendido_periodo: 9, cobertura_dias: 9.3, urgencia: 'medio' },
    { codigo: '08812502', produto: 'CALÇA MOLETOM PELUCIADO', variacao: 'PRETO / M', estoque_atual: 4, vendido_periodo: 8, cobertura_dias: 14.0, urgencia: 'medio' },
    { codigo: '05642180', produto: 'LEGGING SUPLEX', variacao: 'CINZA / M', estoque_atual: 5, vendido_periodo: 8, cobertura_dias: 17.5, urgencia: 'medio' },
    { codigo: '06324802', produto: 'BLUSA RIBANA CANELADA', variacao: 'OFF / M', estoque_atual: 4, vendido_periodo: 7, cobertura_dias: 16.0, urgencia: 'medio' },
    { codigo: '09127343', produto: 'SHORT TACTEL', variacao: 'PRETO / G', estoque_atual: 6, vendido_periodo: 7, cobertura_dias: 24.0, urgencia: 'medio' },
    { codigo: '03987114', produto: 'CAMISETA BÁSICA COTTON', variacao: 'CINZA / P', estoque_atual: 4, vendido_periodo: 6, cobertura_dias: 18.7, urgencia: 'medio' },
  ],
  curva_abc: {
    resumo: [
      { classe: 'A', skus: 38, percentual_skus: 8, percentual_receita: 62, ticket_medio: 89.50, cobertura_media_dias: 11, descricao: 'Top de vendas — concentram a maior parte da receita. Acompanhamento diário, cobertura mínima crítica.' },
      { classe: 'B', skus: 142, percentual_skus: 30, percentual_receita: 28, ticket_medio: 62.30, cobertura_media_dias: 22, descricao: 'Camada intermediária — boa rotação, cobertura confortável. Monitorar semanalmente.' },
      { classe: 'C', skus: 293, percentual_skus: 62, percentual_receita: 10, ticket_medio: 41.80, cobertura_media_dias: 78, descricao: 'Longa cauda — baixa rotação. Concentra capital parado, candidatos a liquidação/descontinuação.' },
    ],
    detalhes: [
      { posicao: 1, classe: 'A', codigo: '02038412', produto: 'BABY LOOK COTTON PREMIUM', variacao: 'PRETO / P', vendido: 47, receita: 6580, pct_receita: 4.8 },
      { posicao: 2, classe: 'A', codigo: '04701233', produto: 'REGATA SUPLEX', variacao: 'BRANCO / M', vendido: 38, receita: 4940, pct_receita: 3.6 },
      { posicao: 3, classe: 'A', codigo: '08812501', produto: 'CALÇA MOLETOM PELUCIADO', variacao: 'CINZA / G', vendido: 31, receita: 4805, pct_receita: 3.5 },
      { posicao: 4, classe: 'A', codigo: '02038413', produto: 'BABY LOOK COTTON PREMIUM', variacao: 'BRANCO / M', vendido: 28, receita: 3920, pct_receita: 2.9 },
      { posicao: 5, classe: 'A', codigo: '03987112', produto: 'CAMISETA BÁSICA COTTON', variacao: 'PRETO / M', vendido: 26, receita: 3640, pct_receita: 2.7 },
      { posicao: 6, classe: 'A', codigo: '03987113', produto: 'CAMISETA BÁSICA COTTON', variacao: 'BRANCO / G', vendido: 24, receita: 3360, pct_receita: 2.5 },
      { posicao: 7, classe: 'A', codigo: '06324801', produto: 'BLUSA RIBANA CANELADA', variacao: 'PRETO / P', vendido: 22, receita: 3168, pct_receita: 2.3 },
      { posicao: 8, classe: 'A', codigo: '05642178', produto: 'LEGGING SUPLEX', variacao: 'PRETO / P', vendido: 21, receita: 3150, pct_receita: 2.3 },
      { posicao: 9, classe: 'A', codigo: '05642179', produto: 'LEGGING SUPLEX', variacao: 'PRETO / M', vendido: 20, receita: 3000, pct_receita: 2.2 },
      { posicao: 10, classe: 'A', codigo: '09127342', produto: 'SHORT TACTEL', variacao: 'AZUL MARINHO / M', vendido: 18, receita: 2520, pct_receita: 1.9 },
      { posicao: 11, classe: 'A', codigo: '07811923', produto: 'BLUSA MANGA LONGA RIBANA', variacao: 'CINZA / M', vendido: 17, receita: 2516, pct_receita: 1.9 },
      { posicao: 12, classe: 'A', codigo: '12056784', produto: 'SHORT BERMUDA MOLETOM', variacao: 'PRETO / M', vendido: 16, receita: 2400, pct_receita: 1.8 },
      { posicao: 13, classe: 'A', codigo: '04812370', produto: 'BABY LOOK GOLA V', variacao: 'PRETO / P', vendido: 15, receita: 2175, pct_receita: 1.6 },
      { posicao: 14, classe: 'A', codigo: '04812371', produto: 'BABY LOOK GOLA V', variacao: 'BRANCO / M', vendido: 14, receita: 2030, pct_receita: 1.5 },
      { posicao: 15, classe: 'A', codigo: '08234561', produto: 'CALÇA LEGGING FITNESS', variacao: 'AZUL / M', vendido: 13, receita: 2015, pct_receita: 1.5 },
      { posicao: 16, classe: 'B', codigo: '06789102', produto: 'TOP FITNESS CROPPED', variacao: 'PRETO / P', vendido: 13, receita: 1820, pct_receita: 1.3 },
      { posicao: 17, classe: 'B', codigo: '02038414', produto: 'BABY LOOK COTTON PREMIUM', variacao: 'OFF / G', vendido: 12, receita: 1680, pct_receita: 1.2 },
      { posicao: 18, classe: 'B', codigo: '06789103', produto: 'TOP FITNESS CROPPED', variacao: 'PRETO / M', vendido: 12, receita: 1680, pct_receita: 1.2 },
      { posicao: 19, classe: 'B', codigo: '09456321', produto: 'BLUSÃO MOLETOM CAPUZ', variacao: 'CINZA / G', vendido: 11, receita: 1815, pct_receita: 1.3 },
      { posicao: 20, classe: 'B', codigo: '02038415', produto: 'BABY LOOK COTTON PREMIUM', variacao: 'AZUL / P', vendido: 11, receita: 1540, pct_receita: 1.1 },
      { posicao: 21, classe: 'B', codigo: '11293048', produto: 'SHORT BERMUDA TACTEL', variacao: 'PRETO / GG', vendido: 9, receita: 1350, pct_receita: 1.0 },
      { posicao: 22, classe: 'B', codigo: '04701234', produto: 'REGATA SUPLEX', variacao: 'PRETO / M', vendido: 10, receita: 1300, pct_receita: 0.95 },
      { posicao: 23, classe: 'B', codigo: '11293049', produto: 'SHORT BERMUDA TACTEL', variacao: 'MARINHO / G', vendido: 10, receita: 1500, pct_receita: 1.1 },
      { posicao: 24, classe: 'B', codigo: '13478965', produto: 'CONJUNTO FITNESS', variacao: 'PRETO / P', vendido: 9, receita: 1530, pct_receita: 1.1 },
      { posicao: 25, classe: 'B', codigo: '07811924', produto: 'BLUSA MANGA LONGA RIBANA', variacao: 'PRETO / G', vendido: 9, receita: 1332, pct_receita: 0.97 },
      { posicao: 26, classe: 'B', codigo: '08812502', produto: 'CALÇA MOLETOM PELUCIADO', variacao: 'PRETO / M', vendido: 8, receita: 1240, pct_receita: 0.91 },
      { posicao: 27, classe: 'B', codigo: '05642180', produto: 'LEGGING SUPLEX', variacao: 'CINZA / M', vendido: 8, receita: 1200, pct_receita: 0.88 },
      { posicao: 28, classe: 'B', codigo: '06324802', produto: 'BLUSA RIBANA CANELADA', variacao: 'OFF / M', vendido: 7, receita: 1008, pct_receita: 0.74 },
      { posicao: 29, classe: 'B', codigo: '09127343', produto: 'SHORT TACTEL', variacao: 'PRETO / G', vendido: 7, receita: 980, pct_receita: 0.72 },
      { posicao: 30, classe: 'C', codigo: '03987114', produto: 'CAMISETA BÁSICA COTTON', variacao: 'CINZA / P', vendido: 6, receita: 840, pct_receita: 0.61 },
    ],
  },
  alertas: [
    {
      prioridade: 'alta',
      tipo: 'ruptura',
      titulo: 'Risco de ruptura em SKUs classe A',
      detalhe: '3 produtos líderes de venda do período com cobertura abaixo de 2 dias. Ruptura iminente afeta diretamente a receita.',
    },
    {
      prioridade: 'media',
      tipo: 'capital_parado',
      titulo: 'R$ 87 mil empoçados em mix de baixa rotação',
      detalhe: 'Cores e tamanhos com cobertura acima de 90 dias. Avaliar liquidação ou descontinuação.',
    },
    {
      prioridade: 'media',
      tipo: 'mix',
      titulo: 'Variações de tamanho extremo (PP/XGG) com giro nulo',
      detalhe: 'Reavaliar a grade de produção para reduzir variações sem demanda recorrente.',
    },
  ],
  recomendacoes: [
    {
      prioridade: 'alta',
      acao: 'repor',
      produto: 'BABY LOOK COTTON PREMIUM (PRETO/P, BRANCO/M, OFF/G)',
      motivo:
        'Top 3 da venda no período com cobertura crítica. Ruptura desses SKUs custa em média R$ 2.800/dia em vendas perdidas.',
      fundamentacao:
        'Política de cobertura mínima por classe (classe A ≥ 15 dias) — reduzir risco de ruptura sem inflacionar capital.',
      impacto_esperado: 'Evitar perda de ~R$ 14k em vendas nos próximos 5 dias',
    },
    {
      prioridade: 'alta',
      acao: 'promover',
      produto: 'Variações classe C com cobertura > 90 dias',
      motivo:
        'Capital empoçado bloqueia compra de SKUs de alto giro. Liberar essa caixa permite escalar o mix premium.',
      fundamentacao:
        'Princípio do giro: estoque parado é custo de oportunidade. Liquidar com 20-30% de desconto traz capital sem comprometer margem do mix principal.',
      impacto_esperado: 'Liberar ~R$ 60k em capital de giro em 30 dias',
    },
    {
      prioridade: 'media',
      acao: 'descontinuar',
      produto: 'Tamanhos PP e XGG sem giro em 90 dias',
      motivo:
        'Custo de carregamento (espaço, gestão) não justifica manter variações sem demanda observada.',
      fundamentacao:
        'Lei de Pareto aplicada ao SKU: 20% das variações respondem por 80% da venda — eliminar a longa cauda inútil simplifica operação.',
      impacto_esperado: 'Reduzir 18% do total de SKUs ativos sem perda de receita',
    },
  ],
  glossario: [
    { termo: 'Cobertura (em dias)', definicao: 'Quanto tempo o estoque atual aguenta se as vendas mantiverem o ritmo. Calculada como estoque ÷ velocidade média de venda.' },
    { termo: 'Curva ABC', definicao: 'Classificação por receita: A = top 20% que geram 80% do faturamento; B = intermediários; C = longa cauda.' },
    { termo: 'Giro de estoque', definicao: 'Quantas vezes o estoque "vira" no período. Quanto maior, mais saudável o capital de giro.' },
    { termo: 'Ruptura', definicao: 'Falta de produto no momento da venda. Custo direto: venda perdida. Custo indireto: cliente vai ao concorrente.' },
  ],
}
// =====================================================================

const saudeTone: Record<string, 'green' | 'orange' | 'red' | 'muted'> = {
  boa: 'green',
  atencao: 'orange',
  critica: 'red',
  indisponivel: 'muted',
}

const sevTone: Record<string, 'red' | 'orange' | 'green' | 'muted'> = {
  critico: 'red',
  atencao: 'orange',
  ok: 'green',
}

const sevBorder: Record<string, string> = {
  critico: 'border-[var(--danger)]/50',
  atencao: 'border-[var(--accent)]/50',
  ok: 'border-[var(--success)]/40',
}

const toneByPrioridade: Record<string, 'red' | 'orange' | 'blue' | 'muted'> = {
  alta: 'red',
  media: 'orange',
  baixa: 'blue',
}

const tomClass: Record<string, string> = {
  positivo: 'text-[var(--success)]',
  atencao: 'text-[var(--accent)]',
  critico: 'text-[var(--danger)]',
}

function fmtDia(iso?: string) {
  return iso ? iso.split('-').reverse().join('/') : ''
}

export default function InsightsEstoquePage() {
  const {
    range,
    setRange,
    data,
    loading,
    error,
    state,
    isBusy,
    run,
    refresh,
    limitMsg,
    intervaloPendente,
  } = useInsightsEstoque()

  const response = data as Record<string, any> | null
  const analiseReal = (response?.analise || null) as AnaliseEstoque | null
  const analise: AnaliseEstoque | null = PREVIEW_PAULO ? (PAULO_MOCK as unknown as AnaliseEstoque) : analiseReal
  const periodoLabel =
    response?.dataInicial && response?.dataFinal
      ? `${fmtDia(response.dataInicial)} a ${fmtDia(response.dataFinal)}`
      : null
  const geradoEm = analise?.gerado_em ? new Date(analise.gerado_em).toLocaleString('pt-BR') : null
  const saude = analise?.saude_estoque
  const blocos = (analise?.blocos || []).filter((b) => b.titulo || b.conteudo)
  const indicadores = analise?.indicadores || []
  const alertas = analise?.alertas || []
  const recomendacoes = analise?.recomendacoes || []
  const glossario = analise?.glossario || []
  const reposicaoUrgente = analise?.reposicao_urgente || []
  const curvaAbc = analise?.curva_abc || { resumo: [], detalhes: [] }

  return (
    <div>
      <PageHeader
        eyebrow="Análise inteligente · Estoque/PCP"
        title="IA Estoque"
        description="Paulo (PhD em PCP) faz uma análise PONTUAL do estoque cruzado com as vendas do intervalo selecionado. O estoque é posição atual (snapshot); giro, cobertura e ruptura seguem o intervalo."
        meta={
          <>
            {periodoLabel && <StatusPill tone="orange">{periodoLabel}</StatusPill>}
            <StatusPill tone="muted">gpt-4o</StatusPill>
            {geradoEm && <StatusPill tone="muted">Gerado {geradoEm}</StatusPill>}
          </>
        }
      />

      {/* Seletor próprio desta página (independente) */}
      <div className="mb-4">
        <DateRangePicker
          value={range}
          onChange={setRange}
          note={limitMsg}
          hidePresets
          showAtualizar
          onAtualizar={run}
          atualizando={isBusy}
        />
      </div>

      {/* Status da coleta */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {isBusy && <StatusPill tone="blue">Analisando {fmtDia(range.dataInicial)} a {fmtDia(range.dataFinal)}…</StatusPill>}
        {!isBusy && intervaloPendente && (
          <StatusPill tone="orange">Intervalo alterado — clique em Atualizar para recolher</StatusPill>
        )}
        {state === 'success' && <StatusPill tone="green">Análise atualizada!</StatusPill>}
        {state === 'timeout' && <StatusPill tone="red">Tempo esgotado — tente novamente</StatusPill>}
        {state === 'error' && <StatusPill tone="red">Falha ao iniciar a análise</StatusPill>}
        <button onClick={refresh} className="action-button ml-auto px-4 text-xs font-bold">
          Recarregar
        </button>
      </div>

      {error && !analise ? (
        <Panel title="Análise indisponível" subtitle="O Paulo ainda não processou este período.">
          <div className="p-6">
            <EmptyState title={error} detail="Selecione o intervalo (máx. 3 meses) e clique em Atualizar." />
          </div>
        </Panel>
      ) : loading && !analise ? (
        <LoadingBlock height="h-40" />
      ) : !analise ? (
        <EmptyState title="Análise ainda não gerada" detail="Defina o intervalo e clique em Atualizar para gerar a leitura do Paulo." />
      ) : (
        <>
          {/* Quadrantes DINAMICOS priorizados pelo Paulo */}
          {blocos.length > 0 && (
            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {blocos.map((b, idx) => {
                const sev = String(b.severidade || 'atencao').toLowerCase()
                return (
                    <div
                    key={`${b.titulo}-${idx}`}
                    className={`hover-card overflow-hidden rounded-2xl border ${sevBorder[sev] || 'border-[var(--border)]'} bg-white/[0.03] p-4`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                      <StatusPill tone={sevTone[sev] || 'muted'}>{sev.toUpperCase()}</StatusPill>
                      {b.categoria && (
                        <span className="min-w-0 break-words text-right text-[10px] font-extrabold uppercase tracking-tight text-[var(--text-muted)]">
                          {b.categoria}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 break-words text-sm font-extrabold text-[var(--text-primary)]">{b.titulo}</div>
                    {b.valor && (
                      <div className="mt-1 break-words text-lg font-extrabold tabular-nums text-[var(--accent)]">
                        {b.valor}
                      </div>
                    )}
                    {b.conteudo && (
                      <p className="m-0 mt-2 break-words text-sm leading-relaxed text-[var(--text-secondary)]">
                        {b.conteudo}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Resumo + saúde + diagnóstico + metodologia */}
          <Panel title="Paulo — Resumo de estoque/PCP" subtitle="Síntese gerada pelo agente">
            <div className="p-5">
              {saude && (
                <div className="mb-3">
                  <StatusPill tone={saudeTone[saude] || 'muted'}>Saúde: {saude.toUpperCase()}</StatusPill>
                </div>
              )}
              <p className="m-0 text-sm leading-relaxed text-[var(--text-primary)]">{analise.resumo_executivo}</p>

              {analise.diagnostico && (
                <div className="mt-4 rounded-xl border border-[var(--border)] bg-white/[0.03] p-4">
                  <div className="text-[11px] font-extrabold uppercase tracking-tight text-[var(--accent)]">Diagnóstico</div>
                  <p className="m-0 mt-1.5 text-sm leading-relaxed text-[var(--text-secondary)]">{analise.diagnostico}</p>
                </div>
              )}

              {analise.metodologia && (
                <div className="mt-3 rounded-xl border border-dashed border-[var(--border)] p-4">
                  <div className="text-[11px] font-extrabold uppercase tracking-tight text-[var(--text-muted)]">
                    Como li os números (metodologia)
                  </div>
                  <p className="m-0 mt-1.5 text-sm leading-relaxed text-[var(--text-secondary)]">{analise.metodologia}</p>
                </div>
              )}
            </div>
          </Panel>

          {/* Indicadores */}
          {indicadores.length > 0 && (
            <div className="mt-4">
              <Panel title="Indicadores" subtitle="Métricas-chave lidas pelo agente">
                <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-5">
                  {indicadores.map((ind, idx) => (
                    <div key={`${ind.label}-${idx}`} className="hover-card-soft rounded-xl border border-[var(--border)] bg-white/[0.03] p-3">
                      <div className="break-words text-[11px] font-extrabold uppercase tracking-tight text-[var(--text-muted)]">{ind.label}</div>
                      <div
                        className={`mt-1 break-words text-lg font-extrabold tabular-nums ${tomClass[ind.tom || ''] || 'text-[var(--text-primary)]'}`}
                      >
                        {ind.valor}
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>
            </div>
          )}

          {/* Curva ABC — visão estratégica do mix do intervalo */}
          {curvaAbc.resumo.length > 0 && (
            <div className="mt-4">
              <Panel title="Curva ABC do mix vendido" subtitle="Classificação por receita no intervalo · Lei de Pareto aplicada ao SKU">
                <div className="p-4">
                  {/* 3 cards de resumo: A, B, C */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {curvaAbc.resumo.map((c) => {
                      const tone =
                        c.classe === 'A' ? 'green' : c.classe === 'B' ? 'orange' : 'muted'
                      const barColor =
                        c.classe === 'A'
                          ? 'bg-[var(--success)]'
                          : c.classe === 'B'
                          ? 'bg-[var(--accent)]'
                          : 'bg-[var(--text-muted)]'
                      return (
                        <div
                          key={c.classe}
                          className="hover-card overflow-hidden rounded-2xl border border-[var(--border)] bg-white/[0.03] p-4"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                            <StatusPill tone={tone}>CLASSE {c.classe}</StatusPill>
                            <span className="break-words text-right text-[10px] font-extrabold uppercase tracking-tight text-[var(--text-muted)]">
                              {c.skus} SKUs · {c.percentual_skus}% do mix
                            </span>
                          </div>
                          <div className="mt-3">
                            <div className="text-[11px] font-extrabold uppercase tracking-tight text-[var(--text-muted)]">
                              Participação na receita
                            </div>
                            <div className="mt-1 flex items-baseline gap-2">
                              <span className="text-2xl font-extrabold text-[var(--text-primary)]">
                                {c.percentual_receita}%
                              </span>
                              <span className="text-xs text-[var(--text-muted)]">
                                ticket {formatBRL(c.ticket_medio)}
                              </span>
                            </div>
                            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[var(--border)]/30">
                              <div
                                className={`h-full ${barColor}`}
                                style={{ width: `${c.percentual_receita}%` }}
                              />
                            </div>
                            <div className="mt-2 text-[11px] text-[var(--text-muted)]">
                              Cobertura média: <b>{c.cobertura_media_dias} dias</b>
                            </div>
                          </div>
                          <p className="m-0 mt-3 text-xs leading-relaxed text-[var(--text-secondary)]">
                            {c.descricao}
                          </p>
                        </div>
                      )
                    })}
                  </div>

                  {/* Tabela detalhada com classificação por SKU */}
                  {curvaAbc.detalhes.length > 0 && (
                    <div className="mt-4 max-h-[520px] overflow-auto pr-1">
                      <table className="data-table min-w-full">
                        <thead className="sticky top-0 z-10 bg-[var(--bg-panel)]">
                          <tr>
                            <th className="w-10">#</th>
                            <th className="w-16">Classe</th>
                            <th>Produto</th>
                            <th>Variação</th>
                            <th className="text-right whitespace-nowrap">Vendido</th>
                            <th className="text-right whitespace-nowrap">Receita</th>
                            <th className="text-right whitespace-nowrap">% Rec.</th>
                          </tr>
                        </thead>
                        <tbody>
                          {curvaAbc.detalhes.map((d, idx) => {
                            const tone =
                              d.classe === 'A' ? 'green' : d.classe === 'B' ? 'orange' : 'muted'
                            return (
                              <tr key={`${d.codigo}-${idx}`}>
                                <td className="text-[var(--text-muted)]">{d.posicao}</td>
                                <td>
                                  <StatusPill tone={tone}>{d.classe}</StatusPill>
                                </td>
                                <td className="break-words">{d.produto}</td>
                                <td className="break-words text-[var(--text-secondary)]">{d.variacao}</td>
                                <td className="text-right whitespace-nowrap">{formatNum(d.vendido)}</td>
                                <td className="text-right text-[var(--text-secondary)] whitespace-nowrap">{formatBRL(d.receita)}</td>
                                <td className="text-right font-bold text-[var(--accent)] whitespace-nowrap">
                                  {formatNum(d.pct_receita, 1)}%
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </Panel>
            </div>
          )}

          {/* Reposição urgente — tabela específica do Paulo (até 30 itens com scroll) */}
          {reposicaoUrgente.length > 0 && (
            <div className="mt-4">
              <Panel title="Reposição urgente" subtitle="Variações com menor cobertura — risco direto de ruptura · até 30 itens">
                <div className="p-3 sm:p-4">
                  <div className="max-h-[520px] overflow-auto pr-1">
                    <table className="data-table min-w-full">
                      <thead className="sticky top-0 z-10 bg-[var(--bg-panel)]">
                        <tr>
                          <th>Produto</th>
                          <th>Variação</th>
                          <th className="text-right whitespace-nowrap">Vendido</th>
                          <th className="text-right whitespace-nowrap">Estoque</th>
                          <th className="text-right whitespace-nowrap">Cobertura</th>
                          <th className="whitespace-nowrap">Urgência</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reposicaoUrgente.slice(0, 30).map((r, idx) => (
                          <tr key={`${r.codigo}-${idx}`}>
                            <td className="break-words">{r.produto}</td>
                            <td className="break-words text-[var(--text-secondary)]">{r.variacao}</td>
                            <td className="text-right whitespace-nowrap">{formatNum(r.vendido_periodo)}</td>
                            <td className="text-right font-bold text-[var(--accent)] whitespace-nowrap">{formatNum(r.estoque_atual)}</td>
                            <td className="text-right text-[var(--text-secondary)] whitespace-nowrap">
                              {formatNum(r.cobertura_dias, 1)}d
                            </td>
                            <td className="whitespace-nowrap">
                              <StatusPill tone={r.urgencia === 'critico' ? 'red' : r.urgencia === 'alto' ? 'orange' : 'muted'}>
                                {r.urgencia.toUpperCase()}
                              </StatusPill>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </Panel>
            </div>
          )}

          {/* Alertas + Recomendações */}
          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Panel title={`Alertas (${alertas.length})`} subtitle="Itens que exigem atenção">
              <div className="space-y-2 p-4">
                {alertas.length === 0 ? (
                  <EmptyState title="Sem alertas" detail="O agente não sinalizou alertas neste período." />
                ) : (
                  alertas.map((a, idx) => (
                    <div key={`${a.titulo}-${idx}`} className="hover-card-soft rounded-xl border border-[var(--border)] bg-white/[0.02] p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusPill tone={toneByPrioridade[a.prioridade || 'baixa'] || 'muted'}>
                          {(a.prioridade || 'baixa').toUpperCase()}
                        </StatusPill>
                        {a.tipo && <StatusPill tone="muted">{a.tipo}</StatusPill>}
                      </div>
                      <div className="mt-2 break-words text-sm font-extrabold text-[var(--text-primary)]">{a.titulo}</div>
                      {a.detalhe && <p className="m-0 mt-2 break-words text-sm text-[var(--text-secondary)]">{a.detalhe}</p>}
                    </div>
                  ))
                )}
              </div>
            </Panel>

            <Panel title={`Recomendações (${recomendacoes.length})`} subtitle="Ações sugeridas pelo agente">
              <div className="space-y-2 p-4">
                {recomendacoes.length === 0 ? (
                  <EmptyState title="Sem recomendações" detail="O agente não sugeriu ações neste período." />
                ) : (
                  recomendacoes.map((r, idx) => (
                    <div key={`${r.produto}-${idx}`} className="hover-card-soft rounded-xl border border-[var(--border)] bg-white/[0.02] p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusPill tone={toneByPrioridade[r.prioridade || 'baixa'] || 'muted'}>
                          {(r.prioridade || 'baixa').toUpperCase()}
                        </StatusPill>
                        {r.acao && <StatusPill tone="orange">{r.acao}</StatusPill>}
                      </div>
                      <div className="mt-2 break-words text-sm font-extrabold text-[var(--text-primary)]">{r.produto || 'Ação geral'}</div>
                      {r.motivo && <p className="m-0 mt-2 break-words text-sm text-[var(--text-secondary)]">{r.motivo}</p>}
                      {r.fundamentacao && (
                        <p className="m-0 mt-1.5 break-words border-l-2 border-[var(--accent)]/40 pl-2 text-xs italic text-[var(--text-muted)]">
                          Por quê: {r.fundamentacao}
                        </p>
                      )}
                      {r.impacto_esperado && (
                        <p className="m-0 mt-1 break-words text-xs text-[var(--text-muted)]">Impacto: {r.impacto_esperado}</p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </Panel>
          </div>

          {/* Glossário */}
          {glossario.length > 0 && (
            <div className="mt-4">
              <Panel title="Glossário" subtitle="Termos usados na análise, explicados pelo agente">
                <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
                  {glossario.map((g, idx) => (
                    <div key={`${g.termo}-${idx}`} className="hover-card-soft rounded-xl border border-[var(--border)] bg-white/[0.02] p-3">
                      <div className="break-words text-sm font-extrabold text-[var(--text-primary)]">{g.termo}</div>
                      <p className="m-0 mt-1 break-words text-sm leading-relaxed text-[var(--text-secondary)]">{g.definicao}</p>
                    </div>
                  ))}
                </div>
              </Panel>
            </div>
          )}

          {/* Navegação rápida */}
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <NavLink to="/visao-geral" className="action-button flex items-center justify-center px-3 text-xs font-bold">Visão Geral</NavLink>
            <NavLink to="/insights-financeiro" className="action-button flex items-center justify-center px-3 text-xs font-bold">IA Financeiro</NavLink>
            <NavLink to="/estoque" className="action-button flex items-center justify-center px-3 text-xs font-bold">Estoque</NavLink>
            <NavLink to="/vendas" className="action-button flex items-center justify-center px-3 text-xs font-bold">Vendas</NavLink>
          </div>
        </>
      )}
    </div>
  )
}
