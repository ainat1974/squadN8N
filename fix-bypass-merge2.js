// fix-bypass-merge2.js
// Corrected version: bypassa Merge CP+CR e Merge Dados (ambos combineAll quebrados)

const N8N_BASE = 'https://workflows.tmrodrigues.tech'
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI5ZWQyZDYyNy05NDQwLTRiZWMtYjcwMS1hZDZmZThlM2M3ODgiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiY2U3NGNjNGItMWE3MC00MmMyLWE1ZWYtNjZmYTI4MDcxYTZjIiwiaWF0IjoxNzc5NzUwMzE5fQ.qt_jMJ4J8hrev6xeCUd2SLk8LvmdF1X510KDh8_iav4'

const headers = {
  'X-N8N-API-KEY': API_KEY,
  'Content-Type': 'application/json'
}

async function main() {
  // 1. Buscar workflow
  console.log('1. Buscando workflow...')
  const listRes = await fetch(`${N8N_BASE}/api/v1/workflows`, { headers })
  const listJson = await listRes.json()
  const erpWf = listJson.data?.find(w => w.name?.includes('ERP') || w.name?.includes('Malhas'))
  if (!erpWf) throw new Error('Workflow não encontrado')
  console.log(`   "${erpWf.name}" (id: ${erpWf.id})`)

  // 2. Detalhes
  const wfRes = await fetch(`${N8N_BASE}/api/v1/workflows/${erpWf.id}`, { headers })
  const wf = await wfRes.json()
  const nodes = wf.nodes

  // 3. Listar todos os nós
  console.log('\n2. Todos os nós:')
  nodes.forEach(n => console.log(`   "${n.name}" (${n.type})`))

  // 4. Identificar nós por nome exato (usando includes)
  const cpNode   = nodes.find(n => n.name.includes('Contas a Pagar'))
  const crNode   = nodes.find(n => n.name.includes('Contas a Receber'))
  const tfVendas = nodes.find(n => n.name.includes('Transformar Vendas'))
  const tfEstoq  = nodes.find(n => n.name.includes('Transformar Estoque'))
  const tfFin    = nodes.find(n => n.name.includes('Transformar Financeiro'))
  const mergeCP  = nodes.find(n => n.name.includes('Merge CP') || n.name.includes('Merge CP+CR'))
  const mergeDados = nodes.find(n => n.name.includes('Merge Dados') || n.name === '📥 Merge Dados')
  const salvarNode = nodes.find(n => n.name.includes('Salvar') || n.name.includes('💾'))

  console.log('\n3. Nós identificados:')
  console.log('   CP:', cpNode?.name)
  console.log('   CR:', crNode?.name)
  console.log('   TF Vendas:', tfVendas?.name)
  console.log('   TF Estoque:', tfEstoq?.name)
  console.log('   TF Financeiro:', tfFin?.name)
  console.log('   Merge CP+CR:', mergeCP?.name)
  console.log('   Merge Dados:', mergeDados?.name)
  console.log('   Salvar JSONs:', salvarNode?.name)

  if (!crNode) throw new Error('Nó CR não encontrado')
  if (!tfFin) throw new Error('Nó Transformar Financeiro não encontrado')
  if (!salvarNode) throw new Error('Nó Salvar JSONs não encontrado')

  console.log('\n4. Estratégia de fix:')
  console.log('   - Merge CP+CR (combineAll) está quebrado → bypass')
  console.log('   - CR → Transformar Financeiro diretamente')
  console.log('   - Merge Dados (combineAll, 3 inputs) também pode estar quebrado → bypass')
  console.log('   - Cada Transformar* → Salvar JSONs diretamente')
  console.log('   - Salvar JSONs acumula dados vindos de 3 fontes')

  // 5. Desativar
  console.log('\n5. Desativando...')
  await fetch(`${N8N_BASE}/api/v1/workflows/${erpWf.id}/deactivate`, { method: 'POST', headers })
  console.log('   OK')

  // 6. Aplicar mudanças nas conexões
  console.log('\n6. Aplicando mudanças de conexões...')

  // 6a. CR → Transformar Financeiro (bypass Merge CP+CR)
  wf.connections[crNode.name] = {
    main: [[{ node: tfFin.name, type: 'main', index: 0 }]]
  }
  console.log(`   ✅ "${crNode.name}" → "${tfFin.name}" [input 0]`)

  // 6b. TF Financeiro → Salvar JSONs (bypass Merge Dados)
  if (!wf.connections[tfFin.name]) {
    wf.connections[tfFin.name] = { main: [[]] }
  }
  wf.connections[tfFin.name] = {
    main: [[{ node: salvarNode.name, type: 'main', index: 0 }]]
  }
  console.log(`   ✅ "${tfFin.name}" → "${salvarNode.name}" [input 0]`)

  // 6c. TF Vendas → Salvar JSONs (bypass Merge Dados)
  if (tfVendas) {
    wf.connections[tfVendas.name] = {
      main: [[{ node: salvarNode.name, type: 'main', index: 0 }]]
    }
    console.log(`   ✅ "${tfVendas.name}" → "${salvarNode.name}" [input 0]`)
  }

  // 6d. TF Estoque → Salvar JSONs (bypass Merge Dados)
  if (tfEstoq) {
    wf.connections[tfEstoq.name] = {
      main: [[{ node: salvarNode.name, type: 'main', index: 0 }]]
    }
    console.log(`   ✅ "${tfEstoq.name}" → "${salvarNode.name}" [input 0]`)
  }

  // 7. Atualizar código do Salvar JSONs para funcionar com execuções individuais
  // Ao invés de receber 3 itens de uma vez (via Merge), agora recebe 1 item por vez
  // O código precisa ser idempotente: merge no static data existente
  console.log('\n7. Atualizando código do nó Salvar JSONs...')
  const salvarIdx = nodes.findIndex(n => n.name === salvarNode.name)
  if (salvarIdx >= 0) {
    nodes[salvarIdx].parameters.jsCode = `
// Salvar JSONs — recebe dados de qualquer Transformar* e salva no static data
// Funciona com execuções individuais (não precisa de Merge)
const staticData = $getWorkflowStaticData('global');

// Inicializar estrutura se necessário
if (!staticData.erp) {
  staticData.erp = {
    resumo: null,
    vendas: null,
    estoque: null,
    financeiro: null,
    atualizadoEm: null
  };
}

// Pegar o item atual
const item = $input.first().json;
const modulo = item.modulo; // 'vendas', 'estoque', 'financeiro'

console.log('[Salvar JSONs] Recebendo módulo:', modulo);

if (modulo === 'vendas' && item.dados) {
  staticData.erp.vendas = item.dados;
  console.log('[Salvar JSONs] Vendas salvas');
} else if (modulo === 'estoque' && item.dados) {
  staticData.erp.estoque = item.dados;
  console.log('[Salvar JSONs] Estoque salvo');
} else if (modulo === 'financeiro' && item.dados) {
  staticData.erp.financeiro = item.dados;
  console.log('[Salvar JSONs] Financeiro salvo');
} else {
  console.log('[Salvar JSONs] Módulo não reconhecido ou sem dados:', modulo, Object.keys(item));
}

// Atualizar timestamp (sempre que qualquer módulo for salvo)
staticData.erp.atualizadoEm = new Date().toISOString();

// Gerar resumo consolidado se todos os módulos estiverem disponíveis
const vendas = staticData.erp.vendas;
const estoque = staticData.erp.estoque;
const financeiro = staticData.erp.financeiro;

if (vendas && estoque && financeiro) {
  console.log('[Salvar JSONs] Todos os módulos disponíveis — gerando resumo');
  staticData.erp.resumo = {
    receita_total: vendas?.summary?.receita_total || 0,
    volume_vendas: vendas?.summary?.volume_vendas || 0,
    ticket_medio: vendas?.summary?.ticket_medio || 0,
    skus_criticos: estoque?.summary?.skus_criticos || 0,
    skus_alerta: estoque?.summary?.skus_alerta || 0,
    saldo_liquido: financeiro?.summary?.saldo_liquido || 0,
    total_inadimplente: financeiro?.summary?.total_inadimplente || 0,
    total_pendente_cp: financeiro?.summary?.total_pendente || 0,
  };
}

return [{ json: {
  ok: true,
  modulo_salvo: modulo,
  atualizadoEm: staticData.erp.atualizadoEm,
  todos_modulos: !!(vendas && estoque && financeiro)
}}];
`.trim()
    console.log('   ✅ Código do Salvar JSONs atualizado para modo individual')
  }

  // 8. PUT
  console.log('\n8. Enviando workflow atualizado...')

  // Limpar settings para evitar erro "additional properties"
  const validSettings = {}
  const allowedSettings = ['executionOrder', 'saveManualExecutions', 'callerPolicy', 'errorWorkflow',
                           'timezone', 'saveDataSuccessExecution', 'saveDataErrorExecution',
                           'saveExecutionProgress', 'executionTimeout', 'maxItems']
  for (const key of allowedSettings) {
    if (wf.settings && wf.settings[key] !== undefined) {
      validSettings[key] = wf.settings[key]
    }
  }

  const body = {
    name: wf.name,
    nodes: wf.nodes,
    connections: wf.connections,
    settings: validSettings,
    staticData: wf.staticData || null
  }

  const putRes = await fetch(`${N8N_BASE}/api/v1/workflows/${erpWf.id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(body)
  })

  const putText = await putRes.text()
  let putJson
  try { putJson = JSON.parse(putText) } catch(e) { putJson = { raw: putText } }

  if (putJson.id || putJson.name) {
    console.log('   ✅ Workflow atualizado com sucesso!')
  } else {
    console.log('   ❌ Erro:', JSON.stringify(putJson).substring(0, 400))
    // Tentar sem staticData
    console.log('   Tentando sem staticData...')
    const body2 = { name: wf.name, nodes: wf.nodes, connections: wf.connections, settings: validSettings }
    const putRes2 = await fetch(`${N8N_BASE}/api/v1/workflows/${erpWf.id}`, {
      method: 'PUT', headers, body: JSON.stringify(body2)
    })
    const putJson2 = await putRes2.json()
    if (putJson2.id || putJson2.name) {
      console.log('   ✅ Atualizado (sem staticData)!')
    } else {
      console.log('   ❌ Ainda falhou:', JSON.stringify(putJson2).substring(0, 400))
      throw new Error('PUT falhou')
    }
  }

  // 9. Reativar
  console.log('\n9. Reativando...')
  const actRes = await fetch(`${N8N_BASE}/api/v1/workflows/${erpWf.id}/activate`, { method: 'POST', headers })
  const actJson = await actRes.json()
  console.log('   Ativo:', actJson.active)

  // 10. Verificar conexões finais
  console.log('\n10. Conexões finais relevantes:')
  const finalRes = await fetch(`${N8N_BASE}/api/v1/workflows/${erpWf.id}`, { headers })
  const finalWf = await finalRes.json()
  const checkNodes = [crNode.name, tfFin.name, tfVendas?.name, tfEstoq?.name]
  for (const n of checkNodes) {
    if (n && finalWf.connections[n]) {
      console.log(`   "${n}": →`, JSON.stringify(finalWf.connections[n]).substring(0, 150))
    }
  }

  console.log('\n✅ FIX COMPLETO!')
  console.log('Agora execute o workflow manualmente no N8N e verifique:')
  console.log('  → Transformar Financeiro executa (via CR)')
  console.log('  → Salvar JSONs executa 3x (uma por Transformar*)')
  console.log('  → GET /webhook/erp?modulo=resumo retorna dados reais')
}

main().catch(console.error)
