const fs = require('fs');

const workflowPath = 'squads/n8n-erp-dashboard/output/workflow-n8n-otimizado.json';
const workflow = JSON.parse(fs.readFileSync(workflowPath, 'utf8'));

const requiredNodes = [
  '📅 Definir Período',
  '🔐 Autenticar Dapic',
  '💾 Preparar Contexto',
  '📊 Coletar Vendas',
  '📦 Coletar Estoque',
  '💸 Coletar Contas a Pagar',
  '💰 Coletar Contas a Receber',
  '🔄 Transformar Vendas',
  '🔄 Transformar Estoque',
  '🔄 Transformar Financeiro',
  '📥 Merge Dados',
  '💾 Salvar JSONs',
  '✅ Notificar Sucesso',
  '⚠️ Error Handler',
  '🚨 Notificar Erro',
];

const nodeNames = new Set(workflow.nodes.map((node) => node.name));
const missingNodes = requiredNodes.filter((name) => !nodeNames.has(name));
if (missingNodes.length) {
  throw new Error(`Missing required nodes: ${missingNodes.join(', ')}`);
}

const collectionNodes = workflow.nodes.filter((node) => node.name.includes('Coletar'));
for (const node of collectionNodes) {
  const code = node.parameters.jsCode || '';
  const checks = {
    backoff: code.includes('delays = [1000, 2000, 4000]'),
    pageSize: code.includes('RegistrosPorPagina: 200'),
    retry429: code.includes('status === 429'),
    retry5xx: code.includes('status >= 500'),
    refresh401: code.includes('status === 401'),
  };
  const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
  if (failed.length) throw new Error(`${node.name} failed checks: ${failed.join(', ')}`);
}

for (const node of workflow.nodes.filter((node) => node.type === 'n8n-nodes-base.code')) {
  const code = node.parameters.jsCode || '';
  try {
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
    new AsyncFunction('$', '$input', '$vars', 'require', code);
  } catch (error) {
    throw new Error(`${node.name} has invalid JavaScript: ${error.message}`);
  }
}

const contextTargets = workflow.connections['💾 Preparar Contexto']?.main?.[0]?.map((edge) => edge.node) || [];
const expectedFanOut = [
  '📊 Coletar Vendas',
  '📦 Coletar Estoque',
  '💸 Coletar Contas a Pagar',
  '💰 Coletar Contas a Receber',
];
for (const target of expectedFanOut) {
  if (!contextTargets.includes(target)) {
    throw new Error(`Missing fan-out target: ${target}`);
  }
}

if (!workflow.nodes.find((node) => node.name === '✅ Notificar Sucesso')?.continueOnFail) {
  throw new Error('Success notification must continue on fail');
}

if (!workflow.nodes.find((node) => node.name === '🚨 Notificar Erro')?.continueOnFail) {
  throw new Error('Error notification must continue on fail');
}

console.log(JSON.stringify({
  ok: true,
  workflow: workflow.name,
  nodes: workflow.nodes.length,
  codeNodesValidated: workflow.nodes.filter((node) => node.type === 'n8n-nodes-base.code').length,
  collectionNodes: collectionNodes.length,
  fanOutTargets: contextTargets,
}, null, 2));
