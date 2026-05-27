// fix-bypass-merge.js
// Bypassa o nó "Merge CP+CR" (combineAll typeVersion 2.1) que está com bug
// e conecta "Coletar CR" diretamente ao "Transformar Financeiro"
// Desta forma, quando CR terminar, TF dispara com os dados do static data

const N8N_BASE = 'https://workflows.tmrodrigues.tech'
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI5ZWQyZDYyNy05NDQwLTRiZWMtYjcwMS1hZDZmZThlM2M3ODgiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiY2U3NGNjNGItMWE3MC00MmMyLWE1ZWYtNjZmYTI4MDcxYTZjIiwiaWF0IjoxNzc5NzUwMzE5fQ.qt_jMJ4J8hrev6xeCUd2SLk8LvmdF1X510KDh8_iav4'

const headers = {
  'X-N8N-API-KEY': API_KEY,
  'Content-Type': 'application/json'
}

async function main() {
  // 1. Buscar lista de workflows
  console.log('1. Buscando workflows...')
  const listRes = await fetch(`${N8N_BASE}/api/v1/workflows`, { headers })
  const listJson = await listRes.json()

  const erpWf = listJson.data?.find(w => w.name?.includes('ERP') || w.name?.includes('Coletar'))
  if (!erpWf) {
    console.log('Workflows encontrados:', listJson.data?.map(w => `${w.id}: ${w.name}`))
    throw new Error('Workflow ERP não encontrado')
  }
  console.log(`   Workflow: "${erpWf.name}" (id: ${erpWf.id}, active: ${erpWf.active})`)

  // 2. Buscar workflow completo
  console.log('2. Buscando detalhes do workflow...')
  const wfRes = await fetch(`${N8N_BASE}/api/v1/workflows/${erpWf.id}`, { headers })
  const wf = await wfRes.json()

  // 3. Diagnosticar conexões atuais
  console.log('\n3. Conexões atuais (CP e CR):')
  const cpKey = Object.keys(wf.connections).find(k => k.includes('Contas a Pagar') || k.includes('CP'))
  const crKey = Object.keys(wf.connections).find(k => k.includes('Contas a Receber') || k.includes('CR'))

  if (cpKey) {
    console.log(`   CP ("${cpKey}"):`, JSON.stringify(wf.connections[cpKey]))
  } else {
    console.log('   CP: não encontrado nas conexões. Checando nomes dos nós...')
  }
  if (crKey) {
    console.log(`   CR ("${crKey}"):`, JSON.stringify(wf.connections[crKey]))
  }

  // Identificar nomes exatos dos nós
  const nodes = wf.nodes
  const cpNode = nodes.find(n => n.name.includes('Contas a Pagar') || (n.name.includes('Coletar') && n.name.includes('CP')))
  const crNode = nodes.find(n => n.name.includes('Contas a Receber') || (n.name.includes('Coletar') && n.name.includes('CR')))
  const tfNode = nodes.find(n => n.name.includes('Transformar Financeiro') || n.name.includes('Transform'))
  const mergeNode = nodes.find(n => n.name.includes('Merge CP') || (n.name.includes('Merge') && !n.name.includes('Dados')))

  console.log('\n   Nós encontrados:')
  console.log('   CP:', cpNode?.name)
  console.log('   CR:', crNode?.name)
  console.log('   TF:', tfNode?.name)
  console.log('   Merge:', mergeNode?.name)

  if (!crNode || !tfNode) {
    throw new Error(`Nó não encontrado: CR=${crNode?.name}, TF=${tfNode?.name}`)
  }

  // 4. Desativar workflow antes de modificar
  console.log('\n4. Desativando workflow...')
  const deactRes = await fetch(`${N8N_BASE}/api/v1/workflows/${erpWf.id}/deactivate`, {
    method: 'POST',
    headers
  })
  const deactJson = await deactRes.json()
  console.log('   Status:', deactJson.active === false ? 'Desativado ✅' : JSON.stringify(deactJson))

  // 5. Modificar conexões
  console.log('\n5. Modificando conexões...')

  // Remover conexão CR → Merge CP+CR e adicionar CR → Transformar Financeiro
  // Também vamos ajustar o Merge Dados se necessário

  if (crNode) {
    // CR passa a disparar TF diretamente (input 0 do TF = onde Merge CP+CR mandava antes)
    wf.connections[crNode.name] = {
      main: [[{
        node: tfNode.name,
        type: 'main',
        index: 0
      }]]
    }
    console.log(`   ✅ ${crNode.name} → ${tfNode.name} [input 0]`)
  }

  // CP: mantém conexão com Merge CP+CR (ou remove se quiser limpar)
  // Mas como TF agora dispara via CR, CP só precisa salvar dados no static data
  // CP não precisa mais de conexão de saída funcional para TF
  // Vamos deixar CP → Merge CP+CR (que agora é um nó "morto") para não quebrar validações
  // OU podemos desconectar CP completamente já que ele só salva dados no static data
  if (cpNode) {
    // Manter CP → Merge CP+CR para não remover o nó do fluxo visualmente
    // mas alternativamente, podemos conectar CP → TF também (input 0 também)
    // Na verdade, o melhor é: CP → TF [input 0] E CR → TF [input 0]
    // TF receberá 2 itens no input 0 = executa 2x ou aguarda ambos?
    // N8N: se dois nós apontam para mesmo input, TF executa UMA vez por item recebido
    // Isso pode causar TF executar 2x - mas isso é OK! Ele lê do static data então
    // ambas execuções produzirão o mesmo resultado

    // Na verdade, o problema é que Merge Dados (combineAll) também pode ser bugado
    // Melhor solução: conectar APENAS CR → TF (CP já salvou dados antes de CR completar)
    // Deixar CP sem saída (ou com saída morta)

    // Manter CP sem mudança (apontando para Merge CP+CR que agora é endpoint morto)
    // Isso não atrapalha porque CP só precisa executar e salvar no static data
    console.log(`   ℹ️  ${cpNode.name}: mantido apontando para Merge CP+CR (não afeta execução)`)
  }

  // 6. Verificar Merge Dados - também é combineAll - pode ser bugado também!
  console.log('\n6. Verificando Merge Dados...')
  const mergeDadosNode = nodes.find(n => n.name.includes('Merge Dados') || n.name === '📥 Merge Dados')
  if (mergeDadosNode) {
    console.log('   Merge Dados tipo:', mergeDadosNode.type, 'parâmetros:', JSON.stringify(mergeDadosNode.parameters))
    console.log('   ATENÇÃO: Se Merge Dados também é combineAll, pode ter o mesmo bug!')

    // Verificar conexões de entrada do Merge Dados
    const mergeDadosInputs = []
    for (const [nodeName, conn] of Object.entries(wf.connections)) {
      if (conn.main) {
        for (const outputs of conn.main) {
          if (outputs) {
            for (const out of outputs) {
              if (out.node === mergeDadosNode.name) {
                mergeDadosInputs.push({ from: nodeName, input: out.index })
              }
            }
          }
        }
      }
    }
    console.log('   Entradas do Merge Dados:', JSON.stringify(mergeDadosInputs))

    // Se Merge Dados também é combineAll, precisamos bypassá-lo também
    // Conectar TF → Salvar JSONs diretamente
    if (mergeDadosNode.parameters?.options?.combineAttributesBy === undefined &&
        (mergeDadosNode.parameters?.mode === 'combine' || mergeDadosNode.type === 'n8n-nodes-base.merge')) {
      console.log('   → Merge Dados pode ser problemático. Vamos conectar TF → Salvar JSONs diretamente também')

      // Encontrar Salvar JSONs
      const salvarNode = nodes.find(n => n.name.includes('Salvar') || n.name.includes('💾'))
      if (salvarNode) {
        // TF → Salvar JSONs diretamente (bypass Merge Dados)
        wf.connections[tfNode.name] = {
          main: [[{
            node: salvarNode.name,
            type: 'main',
            index: 0
          }]]
        }
        console.log(`   ✅ ${tfNode.name} → ${salvarNode.name} [input 0] (bypass Merge Dados)`)
      }
    }
  }

  // 7. Atualizar workflow via PUT
  console.log('\n7. Enviando workflow atualizado...')
  const putRes = await fetch(`${N8N_BASE}/api/v1/workflows/${erpWf.id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      name: wf.name,
      nodes: wf.nodes,
      connections: wf.connections,
      settings: wf.settings || {},
      staticData: wf.staticData
    })
  })
  const putJson = await putRes.json()
  if (putJson.id) {
    console.log('   ✅ Workflow atualizado com sucesso!')
  } else {
    console.log('   ❌ Erro ao atualizar:', JSON.stringify(putJson).substring(0, 300))
    throw new Error('PUT falhou')
  }

  // 8. Reativar workflow
  console.log('\n8. Reativando workflow...')
  const actRes = await fetch(`${N8N_BASE}/api/v1/workflows/${erpWf.id}/activate`, {
    method: 'POST',
    headers
  })
  const actJson = await actRes.json()
  console.log('   Status:', actJson.active === true ? 'Ativo ✅' : JSON.stringify(actJson))

  // 9. Mostrar conexões finais
  console.log('\n9. Conexões após fix:')
  const reloadRes = await fetch(`${N8N_BASE}/api/v1/workflows/${erpWf.id}`, { headers })
  const reloaded = await reloadRes.json()

  const keyNodes = [cpNode?.name, crNode?.name, tfNode?.name, mergeNode?.name, mergeDadosNode?.name]
  for (const nodeName of keyNodes) {
    if (nodeName && reloaded.connections[nodeName]) {
      console.log(`   "${nodeName}":`, JSON.stringify(reloaded.connections[nodeName]))
    }
  }

  console.log('\n✅ FIX APLICADO! Próximos passos:')
  console.log('   1. Trigger workflow manualmente no N8N UI')
  console.log('   2. Verificar que Transformar Financeiro executa')
  console.log('   3. Verificar que Salvar JSONs executa')
  console.log('   4. Testar: GET https://workflows.tmrodrigues.tech/webhook/erp?modulo=resumo')
}

main().catch(console.error)
