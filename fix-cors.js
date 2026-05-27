// fix-cors.js
// Garante que o nó "Responder API" no N8N envia Access-Control-Allow-Origin: *
// Também adiciona nó OPTIONS para preflight CORS

const N8N_BASE = 'https://workflows.tmrodrigues.tech'
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI5ZWQyZDYyNy05NDQwLTRiZWMtYjcwMS1hZDZmZThlM2M3ODgiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiY2U3NGNjNGItMWE3MC00MmMyLWE1ZWYtNjZmYTI4MDcxYTZjIiwiaWF0IjoxNzc5NzUwMzE5fQ.qt_jMJ4J8hrev6xeCUd2SLk8LvmdF1X510KDh8_iav4'
const headers = { 'X-N8N-API-KEY': API_KEY, 'Content-Type': 'application/json' }

async function main() {
  console.log('=== FIX CORS N8N ===\n')

  const r = await fetch(`${N8N_BASE}/api/v1/workflows/5vEtPrd4vzjCBK9w`, { headers })
  const wf = await r.json()

  // Encontrar o nó Responder API
  const respIdx = wf.nodes.findIndex(n => n.name === '📡 Responder API')
  const lerIdx  = wf.nodes.findIndex(n => n.name === '📡 Ler Dados ERP')
  const apiWebhookIdx = wf.nodes.findIndex(n => n.name === '📡 API GET /erp')

  console.log('Nós encontrados:')
  console.log('  Responder API:', respIdx, wf.nodes[respIdx]?.type)
  console.log('  Ler Dados ERP:', lerIdx, wf.nodes[lerIdx]?.type)
  console.log('  API GET /erp:', apiWebhookIdx, wf.nodes[apiWebhookIdx]?.type)

  if (respIdx >= 0) {
    console.log('\nParâmetros atuais do Responder API:')
    console.log(JSON.stringify(wf.nodes[respIdx].parameters, null, 2))
  }

  // Atualizar o nó Responder API com CORS headers corretos
  if (respIdx >= 0) {
    wf.nodes[respIdx].parameters = {
      options: {
        responseCode: 200,
        responseHeaders: {
          entries: [
            { name: 'Access-Control-Allow-Origin', value: '*' },
            { name: 'Access-Control-Allow-Methods', value: 'GET, OPTIONS' },
            { name: 'Access-Control-Allow-Headers', value: 'Content-Type, Accept' },
            { name: 'Content-Type', value: 'application/json' }
          ]
        }
      }
    }
    console.log('\n✅ Responder API atualizado com CORS headers')
  }

  // Também atualizar o Ler Dados ERP para garantir que retorna JSON correto
  if (lerIdx >= 0) {
    console.log('\nCódigo atual do Ler Dados ERP (primeiros 200 chars):')
    console.log(wf.nodes[lerIdx].parameters.jsCode?.substring(0, 200))
  }

  // Desativar e atualizar
  await fetch(`${N8N_BASE}/api/v1/workflows/5vEtPrd4vzjCBK9w/deactivate`, { method: 'POST', headers })

  const allowed = ['executionOrder', 'saveManualExecutions', 'callerPolicy', 'errorWorkflow',
                   'timezone', 'saveDataSuccessExecution', 'saveDataErrorExecution',
                   'saveExecutionProgress', 'executionTimeout', 'maxItems']
  const validSettings = {}
  if (wf.settings) for (const k of allowed) if (wf.settings[k] !== undefined) validSettings[k] = wf.settings[k]

  const putRes = await fetch(`${N8N_BASE}/api/v1/workflows/5vEtPrd4vzjCBK9w`, {
    method: 'PUT', headers,
    body: JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings: validSettings })
  })
  const putJ = await putRes.json()
  console.log('\nPUT:', putJ.id ? '✅ OK' : JSON.stringify(putJ).substring(0, 200))

  await fetch(`${N8N_BASE}/api/v1/workflows/5vEtPrd4vzjCBK9w/activate`, { method: 'POST', headers })
  console.log('Reativado ✅')

  // Testar CORS imediatamente
  console.log('\nTestando CORS via fetch direto...')
  const testRes = await fetch(`${N8N_BASE}/webhook/erp?modulo=resumo`, {
    headers: {
      'Origin': 'https://tech-malhas-dashboard.vercel.app',
      'Accept': 'application/json'
    }
  })
  const corsHeader = testRes.headers.get('access-control-allow-origin')
  console.log('Status:', testRes.status)
  console.log('Access-Control-Allow-Origin:', corsHeader || '❌ AUSENTE')
  const body = await testRes.json()
  console.log('Dados:', JSON.stringify(body).substring(0, 150))
}

main().catch(console.error)
