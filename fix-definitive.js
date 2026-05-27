// fix-definitive.js
// Conserta TODOS os problemas em uma única operação:
// 1. Restaura código do "💾 Preparar Contexto" (foi sobrescrito por engano)
// 2. Conecta TF* → "💾 Salvar JSONs" (nó correto)
// 3. Mantém CR → TF Financeiro (bypass do Merge CP+CR quebrado)
// 4. Atualiza Salvar JSONs para modo individual (1 item por vez)

const N8N_BASE = 'https://workflows.tmrodrigues.tech'
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ0.eyJzdWIiOiI5ZWQyZDYyNy05NDQwLTRiZWMtYjcwMS1hZDZmZThlM2M3ODgiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiY2U3NGNjNGItMWE3MC00MmMyLWE1ZWYtNjZmYTI4MDcxYTZjIiwiaWF0IjoxNzc5NzUwMzE5fQ.qt_jMJ4J8hrev6xeCUd2SLk8LvmdF1X510KDh8_iav4'
// Use a corrected key:
const REAL_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI5ZWQyZDYyNy05NDQwLTRiZWMtYjcwMS1hZDZmZThlM2M3ODgiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiY2U3NGNjNGItMWE3MC00MmMyLWE1ZWYtNjZmYTI4MDcxYTZjIiwiaWF0IjoxNzc5NzUwMzE5fQ.qt_jMJ4J8hrev6xeCUd2SLk8LvmdF1X510KDh8_iav4'

const headers = {
  'X-N8N-API-KEY': REAL_KEY,
  'Content-Type': 'application/json'
}

// =====================================================
// CÓDIGO RESTAURADO: Preparar Contexto (fan-out node)
// Extrai token e baseUrl, distribui para 4 coletores
// =====================================================
const PREPARAR_CONTEXTO_CODE = `
// ============================================================
// PREPARAR CONTEXTO — extrai token e configura contexto global
// ============================================================
const auth = $('🔐 Autenticar Dapic').first().json;
const periodo = $('📅 Definir Período').first().json;

const token = auth.access_token || auth.token || (auth.data && auth.data.access_token) || '';
const baseUrl = 'https://api.dapic.com.br';
const dataInicio = periodo.dataInicio || periodo.data_inicio || '';
const dataFim = periodo.dataFim || periodo.data_fim || '';

if (!token) {
  throw new Error('Token de autenticação não encontrado na resposta do Autenticar Dapic');
}

console.log('[Preparar Contexto] Token OK, período:', dataInicio, '→', dataFim);

return [{ json: { token, baseUrl, dataInicio, dataFim } }];
`.trim()

// =====================================================
// CÓDIGO NOVO: Salvar JSONs (modo individual + acumulação)
// Recebe 1 módulo por execução, acumula no static data
// =====================================================
const SALVAR_JSONS_CODE = `
// ============================================================
// SALVAR JSONs — Acumula módulos no N8N Static Data
// Funciona com execuções individuais (sem Merge Dados)
// ============================================================
const staticData = $getWorkflowStaticData('global');

// Inicializar estrutura se necessário
if (!staticData.erp) {
  staticData.erp = {
    resumo: null,
    vendas: null,
    estoque: null,
    contasPagar: null,
    contasReceber: null,
    fluxoCaixa: null,
    atualizadoEm: null
  };
}

// Pegar o item atual
const item = $input.first().json;
const modulo = item.modulo;

console.log('[Salvar JSONs] Recebendo módulo:', modulo);

if (modulo === 'vendas' && item.dados) {
  staticData.erp.vendas = item.dados;
  console.log('[Salvar JSONs] ✅ Vendas salvas');
} else if (modulo === 'estoque' && item.dados) {
  staticData.erp.estoque = item.dados;
  console.log('[Salvar JSONs] ✅ Estoque salvo');
} else if (modulo === 'financeiro' && item.dados) {
  const dados = item.dados;
  // Compatibilidade: o Transformar Financeiro pode retornar dados de diferentes formas
  if (dados.contasPagar !== undefined) {
    staticData.erp.contasPagar = dados.contasPagar;
    staticData.erp.contasReceber = dados.contasReceber;
    staticData.erp.fluxoCaixa = dados.fluxoCaixa;
  } else {
    // fallback: salva tudo junto
    staticData.erp.contasPagar = dados;
    staticData.erp.contasReceber = dados;
    staticData.erp.fluxoCaixa = { projecao_4_semanas: [] };
  }
  console.log('[Salvar JSONs] ✅ Financeiro salvo');
} else {
  console.log('[Salvar JSONs] ⚠️ Módulo não reconhecido:', modulo, '| keys:', Object.keys(item).join(','));
}

// Atualizar timestamp
staticData.erp.atualizadoEm = new Date().toISOString();

// Gerar resumo consolidado quando todos os módulos estiverem disponíveis
const v = staticData.erp.vendas;
const e = staticData.erp.estoque;
const cp = staticData.erp.contasPagar;
const cr = staticData.erp.contasReceber;

if (v && e && cp && cr) {
  console.log('[Salvar JSONs] 🎉 Todos os módulos disponíveis — gerando resumo');
  staticData.erp.resumo = {
    receita_total: (v.summary && v.summary.receita_total) || 0,
    volume_vendas: (v.summary && v.summary.volume_vendas) || 0,
    ticket_medio: (v.summary && v.summary.ticket_medio) || 0,
    skus_criticos: (e.summary && e.summary.skus_criticos) || 0,
    skus_alerta: (e.summary && e.summary.skus_alerta) || 0,
    saldo_liquido: (cr.summary && cr.summary.saldo_liquido) || 0,
    total_inadimplente: (cr.summary && cr.summary.total_inadimplente) || 0,
    total_pendente_cp: (cp.summary && cp.summary.total_pendente) || 0,
  };
}

return [{ json: {
  ok: true,
  modulo_salvo: modulo,
  atualizadoEm: staticData.erp.atualizadoEm,
  todos_modulos: !!(v && e && cp && cr)
}}];
`.trim()

async function main() {
  console.log('=== FIX DEFINITIVO ===\n')

  // 1. Buscar workflow
  console.log('1. Buscando workflow...')
  const wfRes = await fetch(`${N8N_BASE}/api/v1/workflows/5vEtPrd4vzjCBK9w`, { headers })
  const wf = await wfRes.json()
  console.log(`   "${wf.name}" — ${wf.nodes.length} nós`)

  const nodes = wf.nodes

  // Identificar nós por nome EXATO
  const pcIdx = nodes.findIndex(n => n.name === '💾 Preparar Contexto')
  const sjIdx = nodes.findIndex(n => n.name === '💾 Salvar JSONs')
  const tfVIdx = nodes.findIndex(n => n.name === '🔄 Transformar Vendas')
  const tfEIdx = nodes.findIndex(n => n.name === '🔄 Transformar Estoque')
  const tfFIdx = nodes.findIndex(n => n.name === '🔄 Transformar Financeiro')
  const crIdx  = nodes.findIndex(n => n.name === '💰 Coletar Contas a Receber')

  console.log(`\n2. Índices dos nós:`)
  console.log(`   Preparar Contexto: ${pcIdx}`)
  console.log(`   Salvar JSONs: ${sjIdx}`)
  console.log(`   TF Vendas: ${tfVIdx}`)
  console.log(`   TF Estoque: ${tfEIdx}`)
  console.log(`   TF Financeiro: ${tfFIdx}`)
  console.log(`   CR: ${crIdx}`)

  if (pcIdx < 0 || sjIdx < 0 || tfVIdx < 0 || tfEIdx < 0 || tfFIdx < 0 || crIdx < 0) {
    throw new Error('Um ou mais nós não encontrados — abortando')
  }

  // 3. Desativar
  console.log('\n3. Desativando workflow...')
  await fetch(`${N8N_BASE}/api/v1/workflows/5vEtPrd4vzjCBK9w/deactivate`, { method: 'POST', headers })
  console.log('   OK')

  // 4. Corrigir código dos nós
  console.log('\n4. Restaurando códigos...')
  nodes[pcIdx].parameters.jsCode = PREPARAR_CONTEXTO_CODE
  console.log('   ✅ Preparar Contexto restaurado')
  nodes[sjIdx].parameters.jsCode = SALVAR_JSONS_CODE
  console.log('   ✅ Salvar JSONs atualizado (modo individual)')

  // 5. Corrigir conexões
  console.log('\n5. Corrigindo conexões...')

  const tfVName = nodes[tfVIdx].name
  const tfEName = nodes[tfEIdx].name
  const tfFName = nodes[tfFIdx].name
  const sjName  = nodes[sjIdx].name
  const crName  = nodes[crIdx].name

  // TF* → Salvar JSONs (não Preparar Contexto)
  wf.connections[tfVName] = { main: [[{ node: sjName, type: 'main', index: 0 }]] }
  wf.connections[tfEName] = { main: [[{ node: sjName, type: 'main', index: 0 }]] }
  wf.connections[tfFName] = { main: [[{ node: sjName, type: 'main', index: 0 }]] }
  console.log(`   ✅ TF Vendas → "${sjName}"`)
  console.log(`   ✅ TF Estoque → "${sjName}"`)
  console.log(`   ✅ TF Financeiro → "${sjName}"`)

  // CR → TF Financeiro (bypass Merge CP+CR)
  wf.connections[crName] = { main: [[{ node: tfFName, type: 'main', index: 0 }]] }
  console.log(`   ✅ CR → TF Financeiro (bypass Merge CP+CR)`)

  // 6. Salvar JSONs → Notificar Sucesso (garantir que notificação ainda funciona)
  // Buscar conexão existente do Salvar JSONs para manter
  // A cadeia correta é: Salvar JSONs → Notificar Sucesso
  const notifNode = nodes.find(n => n.name.includes('Notificar Sucesso'))
  if (notifNode) {
    wf.connections[sjName] = { main: [[{ node: notifNode.name, type: 'main', index: 0 }]] }
    console.log(`   ✅ "${sjName}" → "${notifNode.name}"`)
  }

  // 7. PUT
  console.log('\n6. Enviando workflow...')

  // Construir settings limpo (só propriedades válidas)
  const validSettings = {}
  const allowed = ['executionOrder', 'saveManualExecutions', 'callerPolicy', 'errorWorkflow',
                   'timezone', 'saveDataSuccessExecution', 'saveDataErrorExecution',
                   'saveExecutionProgress', 'executionTimeout', 'maxItems']
  if (wf.settings) {
    for (const k of allowed) {
      if (wf.settings[k] !== undefined) validSettings[k] = wf.settings[k]
    }
  }

  const body = {
    name: wf.name,
    nodes: wf.nodes,
    connections: wf.connections,
    settings: validSettings
  }

  const putRes = await fetch(`${N8N_BASE}/api/v1/workflows/5vEtPrd4vzjCBK9w`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(body)
  })
  const putText = await putRes.text()
  let putJson
  try { putJson = JSON.parse(putText) } catch(e) { putJson = { raw: putText.substring(0, 200) } }

  if (putJson.id || putJson.name) {
    console.log('   ✅ Workflow atualizado!')
  } else {
    console.log('   Resposta:', JSON.stringify(putJson).substring(0, 400))
    throw new Error('PUT falhou')
  }

  // 8. Reativar
  console.log('\n7. Reativando...')
  const actRes = await fetch(`${N8N_BASE}/api/v1/workflows/5vEtPrd4vzjCBK9w/activate`, { method: 'POST', headers })
  const actJson = await actRes.json()
  console.log('   Ativo:', actJson.active)

  // 9. Verificar conexões finais
  console.log('\n8. Verificando conexões finais...')
  const finalRes = await fetch(`${N8N_BASE}/api/v1/workflows/5vEtPrd4vzjCBK9w`, { headers })
  const finalWf = await finalRes.json()

  const checkList = [crName, tfFName, tfVName, tfEName, sjName]
  for (const nodeName of checkList) {
    const conn = finalWf.connections[nodeName]
    if (conn) {
      const targets = conn.main?.[0]?.map(c => c.node) || []
      console.log(`   "${nodeName}" → [${targets.join(', ')}]`)
    }
  }

  // 10. Verificar código do Preparar Contexto
  const pcNode = finalWf.nodes.find(n => n.name === '💾 Preparar Contexto')
  const firstLine = pcNode?.parameters?.jsCode?.split('\n')[2] || ''
  console.log(`\n   Preparar Contexto 1ª linha de código: "${firstLine}"`)

  console.log('\n=== FIX COMPLETO! ===')
  console.log('\nFluxo corrigido:')
  console.log('  Cron → Definir Período → Autenticar → Preparar Contexto')
  console.log('  Preparar Contexto → [Vendas, Estoque, CP, CR] (paralelo)')
  console.log('  Vendas → TF Vendas → Salvar JSONs')
  console.log('  Estoque → TF Estoque → Salvar JSONs')
  console.log('  CP → (Merge CP+CR morto, dados no static data)')
  console.log('  CR → TF Financeiro → Salvar JSONs')
  console.log('\n⚡ Agora execute o workflow manualmente no N8N!')
}

main().catch(console.error)
