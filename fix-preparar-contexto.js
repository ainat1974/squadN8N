// fix-preparar-contexto.js
// Fix: Preparar Contexto agora propaga TODAS as datas para que CP/CR/TF Financeiro funcionem

const N8N_BASE = 'https://workflows.tmrodrigues.tech'
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI5ZWQyZDYyNy05NDQwLTRiZWMtYjcwMS1hZDZmZThlM2M3ODgiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiY2U3NGNjNGItMWE3MC00MmMyLWE1ZWYtNjZmYTI4MDcxYTZjIiwiaWF0IjoxNzc5NzUwMzE5fQ.qt_jMJ4J8hrev6xeCUd2SLk8LvmdF1X510KDh8_iav4'
const headers = { 'X-N8N-API-KEY': API_KEY, 'Content-Type': 'application/json' }

const NEW_PREPARAR_CODE = `// ============================================================
// PREPARAR CONTEXTO — extrai token e propaga datas para coletores
// ============================================================
const auth = $('🔐 Autenticar Dapic').first().json;
const periodo = $('📅 Definir Período').first().json;

const token = auth.access_token || auth.token || (auth.data && auth.data.access_token) || '';
const baseUrl = 'https://api.dapic.com.br';

// Propagar TODAS as datas calculadas por Definir Período
const dataHoje = periodo.dataHoje || new Date().toISOString().split('T')[0];
const data30DiasAtras = periodo.data30DiasAtras || new Date(Date.now() - 30*24*60*60*1000).toISOString().split('T')[0];
const data90DiasAtras = periodo.data90DiasAtras || new Date(Date.now() - 90*24*60*60*1000).toISOString().split('T')[0];
const dataMais30Dias = periodo.dataMais30Dias || new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0];
const dataMais7Dias = periodo.dataMais7Dias || new Date(Date.now() + 7*24*60*60*1000).toISOString().split('T')[0];

// Alias de compatibilidade com Coletar Vendas e Estoque
const dataInicio = data30DiasAtras;
const dataFim = dataHoje;

if (!token) {
  throw new Error('Token não encontrado. Resposta Dapic: ' + JSON.stringify(auth).substring(0, 200));
}

console.log('[Preparar Contexto] Token OK. Período:', dataInicio, '→', dataFim);

return [{ json: {
  token, baseUrl,
  dataHoje, data30DiasAtras, data90DiasAtras, dataMais30Dias, dataMais7Dias,
  dataInicio, dataFim
} }];`

async function main() {
  console.log('=== FIX PREPARAR CONTEXTO ===\n')

  // 1. Buscar workflow
  const r = await fetch(`${N8N_BASE}/api/v1/workflows/5vEtPrd4vzjCBK9w`, { headers })
  const wf = await r.json()

  // 2. Atualizar Preparar Contexto
  const pcIdx = wf.nodes.findIndex(n => n.name === '💾 Preparar Contexto')
  if (pcIdx < 0) throw new Error('Preparar Contexto não encontrado')

  wf.nodes[pcIdx].parameters.jsCode = NEW_PREPARAR_CODE
  console.log('✅ Código atualizado')
  console.log('   Campos que serão propagados: token, baseUrl, dataHoje, data30DiasAtras, data90DiasAtras, dataMais30Dias, dataMais7Dias, dataInicio, dataFim')

  // 3. Desativar
  await fetch(`${N8N_BASE}/api/v1/workflows/5vEtPrd4vzjCBK9w/deactivate`, { method: 'POST', headers })

  // 4. PUT com settings limpo
  const validSettings = {}
  const allowed = ['executionOrder', 'saveManualExecutions', 'callerPolicy', 'errorWorkflow',
                   'timezone', 'saveDataSuccessExecution', 'saveDataErrorExecution',
                   'saveExecutionProgress', 'executionTimeout', 'maxItems']
  if (wf.settings) {
    for (const k of allowed) if (wf.settings[k] !== undefined) validSettings[k] = wf.settings[k]
  }

  const putRes = await fetch(`${N8N_BASE}/api/v1/workflows/5vEtPrd4vzjCBK9w`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings: validSettings })
  })
  const putJ = await putRes.json()
  if (!putJ.id && !putJ.name) {
    console.log('PUT falhou:', JSON.stringify(putJ).substring(0, 300))
    throw new Error('PUT failed')
  }
  console.log('✅ Workflow salvo')

  // 5. Reativar
  await fetch(`${N8N_BASE}/api/v1/workflows/5vEtPrd4vzjCBK9w/activate`, { method: 'POST', headers })
  console.log('✅ Workflow ativo')

  // 6. Disparar workflow
  console.log('\nDisparando workflow...')
  const trigRes = await fetch('https://workflows.tmrodrigues.tech/webhook/atualizar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source: 'fix-preparar-contexto' })
  })
  console.log('Trigger status:', trigRes.status)

  // 7. Aguardar execução (máx 45s)
  console.log('Aguardando 40s para execução completar...')
  await new Promise(r => setTimeout(r, 40000))

  // 8. Verificar última execução
  const exRes = await fetch(`${N8N_BASE}/api/v1/executions?workflowId=5vEtPrd4vzjCBK9w&limit=1`, { headers })
  const exJ = await exRes.json()
  const latest = exJ.data?.[0]
  console.log('\nExecução:', latest?.id, '| status:', latest?.status, '| duração:', latest?.stoppedAt ? Math.round((new Date(latest.stoppedAt) - new Date(latest.startedAt)) / 1000) + 's' : 'em andamento')

  if (latest?.id) {
    const dRes = await fetch(`${N8N_BASE}/api/v1/executions/${latest.id}?includeData=true`, { headers })
    const dJ = await dRes.json()
    const rd = dJ.data?.resultData?.runData || {}

    const nodes = ['💾 Preparar Contexto', '💸 Coletar Contas a Pagar', '💰 Coletar Contas a Receber', '🔄 Transformar Financeiro', '💾 Salvar JSONs']
    for (const n of nodes) {
      if (rd[n]) {
        rd[n].forEach((run, i) => {
          const items = run?.data?.main?.[0]?.length || 0
          const err = run?.error?.message || ''
          const first = run?.data?.main?.[0]?.[0]?.json
          const preview = first ? JSON.stringify(first).substring(0, 120) : ''
          console.log(`  ${n}[${i}]: ${items}item${err ? ' ERR:'+err.substring(0,80) : ''} ${preview}`)
        })
      } else {
        console.log(`  ${n}: ❌ não executou`)
      }
    }
  }

  // 9. Checar API
  console.log('\n=== API Checks ===')
  for (const mod of ['resumo', 'contas-pagar', 'contas-receber']) {
    const apiR = await fetch(`${N8N_BASE}/webhook/erp?modulo=${mod}`)
    const apiJ = await apiR.json()
    if (mod === 'resumo') {
      console.log(`resumo: receita=${apiJ.receita_total} | saldo=${apiJ.saldo_liquido} | inadimplente=${apiJ.total_inadimplente} | atualizado=${apiJ.atualizadoEm?.substring(0,19)}`)
    } else {
      const dados = apiJ.dados || {}
      console.log(`${mod}: pendente=${dados.summary?.total_pendente} | vencidos=${dados.vencidos?.length}`)
    }
  }
}

main().catch(console.error)
