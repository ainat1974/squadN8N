# Auditoria Dapic — Capacidade de Alimentar Agentes Financeiro e PCP

> **Objetivo:** Mapear quais informações estratégicas o ERP Dapic disponibiliza via API para alimentar dois agentes especialistas em tomada de decisão: **Agente Financeiro** (CFO) e **Agente PCP** (Planejamento e Controle da Produção).
>
> **Fonte:** `pipeline/data/dapic-api.md` + `output/api-documentation.md` + análise dos endpoints documentados.
>
> **Data:** 2026-05-28 — Auditoria pré-implementação.

---

## 1. Sumário Executivo

A API Dapic é **somente leitura** (com exceção de `POST /v1/pedidosvendassimples`) e oferece **bons fundamentos para análise financeira e de PCP**, com 2 grandes limitações:

| Limitação | Impacto |
|-----------|---------|
| **Sem custo do produto vendido (CMV)** | Margem bruta real e DRE completo não são calculáveis sem fonte complementar |
| **Endpoints volumosos limitados a 31 dias** | Análises de série longa exigem múltiplas chamadas paralelas (movimentações, NF-e, NFC-e) |

Apesar disso, **>80% dos KPIs de decisão clássicos são viáveis** com cálculo derivado a partir dos endpoints atuais.

---

## 2. Inventário de Endpoints Dapic (categorizado por agente)

### 2.1 Endpoints úteis para Agente Financeiro

| Endpoint | Uso |
|----------|-----|
| `GET /v1/contas/parcelas` | Contas a Pagar e Receber — base do fluxo de caixa, aging, inadimplência |
| `GET /v1/contas/pagamentos` | Pagamentos efetivados — base do realizado vs previsto |
| `GET /v1/pedidosvendas` | Receita B2B — faturamento, ticket, representante, cliente |
| `GET /v1/vendas` | Receita PDV — faturamento de balcão |
| `GET /v1/pedidosvendas/{id}` | Detalhes de pagamento (formas, parcelas) |
| `GET /v1/clientes` | Cadastro para análise de concentração e segmentação |
| `GET /v1/representantes` | Performance de vendedor |
| `GET /v1/faturas` | Vendas faturadas (NF emitida) |
| `GET /v1/formaspagamento` | Catálogo de formas de pagamento (cartão/pix/boleto/etc.) |
| `GET /v1/planoscontas` | Estrutura contábil para classificação de despesas |
| `GET /v1/orcamentos` | Pipeline de venda (forecast de receita) |

### 2.2 Endpoints úteis para Agente PCP

| Endpoint | Uso |
|----------|-----|
| `GET /v1/estoques/todos` | Saldo atual consolidado de TODOS os SKUs |
| `GET /v1/estoques` + `/v1/estoques/{id}/produtos` | Saldo por armazenador (CD, loja, etc.) |
| `GET /v1/movimentacoesestoque` | Entradas/saídas — base de giro, cobertura, ponto de pedido |
| `GET /v1/vendas/produtosvendidos` | Demanda histórica consolidada |
| `GET /v1/produtos` | Catálogo + atributos (referência, descrição) |
| `GET /v1/produtos/{id}/estoquesminimos` | Estoque mínimo configurado por SKU — alertas |
| `GET /v1/produtos/{id}/fichatecnica` | Composição/operações para análise produtiva |
| `GET /v1/produtos/{id}/grades` + `GET /v1/produtos/grades` | Variações cor/tamanho |
| `GET /v1/produtos/{id}/localizacoes` | Posicionamento físico no estoque |
| `GET /v1/ordensproducao` | Pipeline de produção em aberto |
| `GET /v1/consignados` | Estoque alocado em terceiros |
| `GET /v1/logisticaentregas` | SLA de entregas |
| `GET /v1/objetospostagem` | Tracking de envios (volumoso, max 31d) |

---

## 3. Auditoria — Agente Financeiro

### 3.1 KPIs viáveis com cálculo direto

| KPI | Endpoint(s) | Cálculo | Decisão que apoia |
|-----|-------------|---------|-------------------|
| **Saldo de caixa atual** | `/v1/contas/pagamentos` agregado | Soma pagamentos recebidos − pagos | "Tenho caixa pra pagar a folha?" |
| **Fluxo de caixa projetado (4–12 sem)** | `/v1/contas/parcelas` | Agrupar por semana de vencimento, separar Tipo (Pagar/Receber) | "Vou ter aperto em qual semana?" |
| **Total a receber pendente** | `/v1/contas/parcelas` | Σ(Valor) onde Tipo=Receber AND Status=Pendente | "Quanto tenho pra entrar?" |
| **Total inadimplente** | `/v1/contas/parcelas` | Σ(Valor) onde Tipo=Receber AND DataVencimento<hoje AND Status≠Recebido | "Quanto está atrasado?" |
| **Aging de inadimplência** | `/v1/contas/parcelas` | Bucketizar dias de atraso: 1–30, 31–60, 61–90, 90+ | "Onde concentrar cobrança?" |
| **Top 10 clientes inadimplentes** | `/v1/contas/parcelas` | Group by Cliente, sort desc por valor vencido | "Quem ligar hoje?" |
| **Receita bruta no período** | `/v1/pedidosvendas` + `/v1/vendas` | Σ(ValorLiquido) onde Status=Faturado | Comparativo MoM/YoY |
| **Receita por canal** | Mesmos | Separar B2B (`/pedidosvendas`) vs PDV (`/vendas`) | "Qual canal cresce?" |
| **Receita por representante** | `/v1/pedidosvendas` | Group by Representante | Comissão, ranking |
| **Ticket médio** | Mesmos | Receita ÷ nº de vendas | Estratégia de pricing |
| **Curva ABC de clientes** | `/v1/pedidosvendas` agregado por cliente | Pareto 80/20 | "Quais clientes proteger?" |
| **Concentração de receita** | Mesma | % top 10 / total | Risco de dependência |
| **PMR (Prazo Médio Recebimento)** | `/v1/contas/parcelas` + `/v1/contas/pagamentos` | Média(DataPagamento − DataEmissão) onde Tipo=Receber | Capital de giro |
| **PMP (Prazo Médio Pagamento)** | Idem para Tipo=Pagar | Espelho do PMR | Capital de giro |
| **Mix de formas de pagamento** | `/v1/pedidosvendas/{id}` detalhado | Group by FormaPagamento | "Aceitar mais Pix?" |
| **Faturamento previsto (orçamentos)** | `/v1/orcamentos` Status=Aberto | Σ(ValorLiquido) | Forecast de receita |

### 3.2 KPIs com viabilidade parcial

| KPI | Limitação | Workaround |
|-----|-----------|------------|
| **Margem bruta** | Não há custo do produto na API | Cliente fornecer planilha de custos OR usar campo `ValorUnitarioCusto` (se existir no detalhe do produto — não documentado) |
| **EBITDA / DRE completo** | Faltam despesas operacionais classificadas (folha, aluguel, etc.) | Usar `/v1/contas/parcelas` Tipo=Pagar + `/v1/planoscontas` para classificar |
| **Análise por região** | Endereço só vem no detalhe do pedido (`/v1/pedidosvendas/{id}`), não na lista | 1 chamada por pedido (custosa) ou enriquecer via `/v1/clientes` |

### 3.3 KPIs **inviáveis** sem dado externo

- **Lucro líquido / Imposto efetivo** (sem dados fiscais consolidados na API)
- **CAC / LTV** (não há custo de aquisição)
- **NPS / Satisfação** (não está no escopo do Dapic)

---

## 4. Auditoria — Agente PCP

### 4.1 KPIs viáveis com cálculo direto

| KPI | Endpoint(s) | Cálculo | Decisão que apoia |
|-----|-------------|---------|-------------------|
| **Saldo atual por SKU** | `/v1/estoques/todos` | Direto | Visão consolidada |
| **Saldo por armazenador** | `/v1/estoques/{id}/produtos` | Direto | Distribuição CD/loja |
| **SKUs em ruptura** | `/v1/estoques/todos` | Quantidade = 0 | Reposição urgente |
| **SKUs em alerta** | `/v1/produtos/{id}/estoquesminimos` + saldo | Saldo < EstoqueMínimo | Alerta proativo |
| **Valor imobilizado em estoque** | `/v1/estoques/todos` | Σ(Quantidade × ValorUnitario) | Capital parado |
| **Curva ABC de produtos** | `/v1/vendas/produtosvendidos` | Pareto 80/20 da receita | Foco operacional |
| **Top 10 vendidos (volume e receita)** | `/v1/vendas/produtosvendidos` | Sort | "O que repor primeiro?" |
| **Giro de estoque (período)** | `/v1/movimentacoesestoque` | Σ(saídas) ÷ saldo médio | "Estoque está rotacionando?" |
| **Cobertura em dias** | Saldo ÷ Venda Média Diária | Saldo ÷ (vendas 30d ÷ 30) | "Quantos dias até zerar?" |
| **Venda Média Diária (VMD)** | `/v1/vendas/produtosvendidos` em janela | Vendas no período ÷ dias úteis | Base p/ ponto de pedido |
| **Variações vendidas (cor/tamanho)** | `/v1/vendas/produtosvendidos` (Grade/Cor/Tamanho) | Group by atributo | Mix de produção |
| **Sazonalidade semanal** | Histórico `/v1/vendas/produtosvendidos` | Vendas semana atual vs anterior | "Está acelerando?" |
| **Sazonalidade mensal** | Idem | Vendas mês atual vs mês anterior, MoM | Planejamento mensal |
| **Comparativo YoY** | Idem (com 1 ano de histórico armazenado) | Mesmo período ano anterior | Sazonalidade real |
| **Estoque consignado** | `/v1/consignados` | Direto | Visibilidade total |
| **Ordens de produção em aberto** | `/v1/ordensproducao` Status=Aberto | Direto | Pipeline produtivo |

### 4.2 KPIs com viabilidade parcial

| KPI | Limitação | Workaround |
|-----|-----------|------------|
| **Lead time de produção** | Depende dos campos da OP (DataAbertura, DataConclusão) | Validar campos retornados em `/v1/ordensproducao/{id}` |
| **Lead time de fornecedor** | Não há endpoint de pedidos de compra na doc atual | Verificar se Dapic expõe módulo de compras (`/v1/pedidoscompras`?) |
| **Ponto de pedido** | Fórmula `(LT × VMD) + Estoque Segurança` exige LT confiável | Usar valor médio histórico ou input manual |
| **Cross-sell / Affinity** | Lista de produtos por venda (`/v1/vendas/{id}/produtos`) exige 1 chamada por venda | Agregação custosa — limitar a top N vendas |
| **Previsão de demanda (ML)** | API só fornece histórico bruto | Lógica de previsão fica no agente (média móvel, Holt-Winters) |

### 4.3 KPIs **inviáveis** sem dado externo

- **Capacidade fabril real** (horas-máquina, eficiência) — não há módulo de chão de fábrica detalhado documentado
- **Qualidade / Refugos** (sem endpoint de não-conformidade)
- **Forecasting com fatores externos** (clima, calendário promocional) — exige fonte externa

---

## 5. Lacunas Críticas (o que a Dapic NÃO oferece)

| Lacuna | Impacto nos agentes | Sugestão |
|--------|---------------------|----------|
| **Custo do produto vendido (CMV)** | Bloqueia margem bruta no Financeiro | Pedir CSV de custos do cliente (atualizado mensalmente) |
| **Pedidos de compra (suprimentos)** | Bloqueia lead time de reposição no PCP | Validar com Dapic se há endpoint não documentado |
| **Despesas classificadas** | DRE simplificado vira aproximação | Usar `/v1/planoscontas` + classificação manual |
| **Dados externos** (calendário, clima, benchmarks) | Análise sazonal limitada | Integrar fonte externa (ex: API IBGE, Hollidays API) |
| **Histórico longo via endpoints volumosos** | Análise YoY exige >12 chamadas | Persistir histórico no N8N/dB próprio (mensal) |

---

## 6. Recomendações de Coleta — para alimentar os agentes

### 6.1 Pacote de coleta — **Agente Financeiro**

| Endpoint | Frequência | Janela | Volume estimado |
|----------|-----------|--------|-----------------|
| `/v1/contas/parcelas` | A cada coleta | Hoje−90d → Hoje+30d | Médio |
| `/v1/contas/pagamentos` | A cada coleta | Hoje−90d → Hoje | Médio |
| `/v1/pedidosvendas` | A cada coleta | Range escolhido | Variável |
| `/v1/vendas` | A cada coleta | Range escolhido | Alto (PDV gera muito volume) |
| `/v1/clientes` | 1× por dia (cache) | — | Baixo |
| `/v1/representantes` | 1× por semana (cache) | — | Baixo |
| `/v1/orcamentos` | A cada coleta | Hoje → Hoje+60d | Baixo |

### 6.2 Pacote de coleta — **Agente PCP**

| Endpoint | Frequência | Janela | Volume estimado |
|----------|-----------|--------|-----------------|
| `/v1/estoques/todos` | A cada coleta | Snapshot atual | Médio |
| `/v1/movimentacoesestoque` | A cada coleta | Hoje−30d → Hoje | **Alto** (volumoso, max 31d) |
| `/v1/vendas/produtosvendidos` | A cada coleta | Range escolhido | Alto |
| `/v1/produtos` | 1× por dia (cache) | — | Médio |
| `/v1/produtos/{id}/estoquesminimos` | 1× por semana | — | Alto (1 chamada por SKU) — **só para SKUs ativos** |
| `/v1/ordensproducao` | A cada coleta | Status=Aberto | Baixo |
| `/v1/consignados` | 1× por dia | — | Baixo |

> ⚠️ **Risco**: o pacote PCP é mais pesado que Financeiro. Recomenda-se **paralelizar** a coleta de Financeiro e PCP em sub-workflows e **cachear** dados estáveis (catálogo de produtos, representantes).

---

## 7. Contrato proposto — Output dos agentes

### 7.1 Agente Financeiro — saída JSON sugerida

```json
{
  "gerado_em": "2026-05-28T18:00:00Z",
  "periodo": { "inicio": "2026-04-01", "fim": "2026-04-30" },
  "caixa": {
    "saldo_atual": 0,
    "fluxo_4_semanas": [
      { "semana": "2026-W22", "entradas": 0, "saidas": 0, "saldo": 0 }
    ]
  },
  "receita": {
    "total": 0,
    "por_canal": { "pdv": 0, "b2b": 0 },
    "ticket_medio": 0,
    "crescimento_mom_pct": 0
  },
  "inadimplencia": {
    "total": 0,
    "percentual_receita": 0,
    "aging": { "ate_30d": 0, "31_60d": 0, "61_90d": 0, "90_mais": 0 },
    "top_clientes": [{ "cliente": "", "valor": 0, "dias_atraso": 0 }]
  },
  "ciclo_financeiro": { "pmr_dias": 0, "pmp_dias": 0 },
  "concentracao_receita": { "top10_pct": 0 },
  "alertas": [
    { "severidade": "alta", "tipo": "fluxo_caixa_negativo_semana", "mensagem": "..." }
  ],
  "recomendacoes": [
    { "acao": "Cobrar cliente X (R$ 12.500 com 45 dias de atraso)", "impacto": "alto" }
  ]
}
```

### 7.2 Agente PCP — saída JSON sugerida

```json
{
  "gerado_em": "2026-05-28T18:00:00Z",
  "periodo": { "inicio": "2026-04-01", "fim": "2026-04-30" },
  "estoque": {
    "valor_total": 0,
    "skus_total": 0,
    "skus_ruptura": 0,
    "skus_alerta": 0
  },
  "curva_abc": {
    "a_skus_count": 0,
    "a_receita_pct": 0,
    "b_skus_count": 0,
    "c_skus_count": 0
  },
  "reposicao_urgente": [
    {
      "produto": "",
      "codigo": "",
      "estoque_atual": 0,
      "vmd": 0,
      "dias_ate_zerar": 0,
      "qtd_sugerida": 0,
      "urgencia": "critico"
    }
  ],
  "tendencia": [
    {
      "produto": "",
      "vendas_semana_atual": 0,
      "vendas_semana_anterior": 0,
      "variacao_pct": 0,
      "tendencia": "subindo"
    }
  ],
  "ordens_producao_abertas": 0,
  "alertas": [
    { "severidade": "alta", "tipo": "ruptura_iminente", "produto": "", "mensagem": "" }
  ],
  "recomendacoes": [
    { "acao": "Repor SKU X (cobertura 3 dias, VMD 12)", "impacto": "alto" }
  ]
}
```

---

## 8. Próximos passos sugeridos

1. **Validação de prioridades** — usuário ranquear quais KPIs são essenciais vs. desejáveis (evita over-engineering).
2. **Confirmar custo do produto** — perguntar à Tech Malhas se existe planilha/sistema externo de custos.
3. **Criar agentes** — `agents/fernanda-financeiro.agent.md` e `agents/paulo-pcp.agent.md` com persona e contrato.
4. **Atualizar workflow N8N** — adicionar coleta dos endpoints listados em §6, em sub-workflows separados (Financeiro vs PCP).
5. **Camada de persistência** — decidir se KPIs derivados ficam:
   - Calculados no N8N (rápido, mas lógica espalhada)
   - Calculados no agente (centralizado, mas exige passar dados brutos)
   - **Híbrido recomendado**: N8N agrega/normaliza, agente interpreta e gera recomendação.
6. **Definir cadência de execução** — agentes rodam sob demanda (botão Atualizar) ou em rotinas separadas?

---

## 9. Anexo — Mapeamento KPI → Endpoint (referência rápida)

| KPI | Endpoint primário | Endpoint complementar |
|-----|-------------------|----------------------|
| Receita total | `/v1/pedidosvendas` + `/v1/vendas` | — |
| Inadimplência | `/v1/contas/parcelas` | `/v1/clientes` |
| Fluxo de caixa | `/v1/contas/parcelas` + `/v1/contas/pagamentos` | — |
| PMR/PMP | `/v1/contas/parcelas` + `/v1/contas/pagamentos` | — |
| Saldo estoque | `/v1/estoques/todos` | `/v1/estoques/{id}/produtos` |
| Giro estoque | `/v1/movimentacoesestoque` | `/v1/vendas/produtosvendidos` |
| Curva ABC | `/v1/vendas/produtosvendidos` | — |
| Ruptura/Alerta | `/v1/estoques/todos` + `/v1/produtos/{id}/estoquesminimos` | — |
| Tendência semanal | `/v1/vendas/produtosvendidos` (histórico) | — |
| Mix pagamento | `/v1/pedidosvendas/{id}` | `/v1/formaspagamento` |
| Pipeline venda | `/v1/orcamentos` Status=Aberto | — |
| Pipeline produção | `/v1/ordensproducao` Status=Aberto | — |
